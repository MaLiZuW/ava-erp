-- =====================================================================
-- Phase 3 – master data (2/3): units, catalog, package bill of materials,
-- labour roles and rates, own resources.
-- Source of truth: docs/DATABASE_SCHEMA.md section 4, BUSINESS_PROCESSES.md 5.1–5.3,
-- approved phase-3 plan (owner decisions: one-level packages; money >= 0;
-- expected_life_hours > 0).
-- =====================================================================

-- exclusion constraint on (role_id =, validity period &&) needs btree_gist
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 1. units (reference data from DATABASE_SCHEMA.md)
-- ---------------------------------------------------------------------
create table public.units (
  code       text primary key check (code ~ '^[a-z0-9šžčťľýáíéúäôň]{1,10}$'),
  name       text not null check (length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.units (code, name) values
  ('ks', 'kus'),
  ('hod', 'hodina'),
  ('bal', 'balenie'),
  ('m', 'meter'),
  ('m2', 'meter štvorcový'),
  ('kg', 'kilogram'),
  ('km', 'kilometer'),
  ('paušál', 'paušál');

-- ---------------------------------------------------------------------
-- 2. catalog_items
-- ---------------------------------------------------------------------
create table public.catalog_items (
  id                   uuid primary key default gen_random_uuid(),
  code                 text unique check (code ~ '^[A-Za-z0-9._/-]{1,30}$'),
  name                 text not null check (length(btrim(name)) between 1 and 200),
  item_type            public.item_type not null,
  division_id          uuid references public.divisions (id),
  unit_code            text not null references public.units (code) on update cascade,
  default_cost_cents   bigint not null default 0 check (default_cost_cents >= 0),
  default_supplier_id  uuid references public.suppliers (id),
  default_pricing_mode public.pricing_mode not null default 'none',
  default_pricing_pct  numeric(7,4) check (default_pricing_pct >= 0),
  description          text check (length(description) <= 4000),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id),
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  -- margin: price = cost / (1 - m) → m must stay below 100 %
  constraint catalog_items_margin_below_100
    check (default_pricing_mode <> 'margin' or default_pricing_pct < 100),
  -- a mode with an increase needs its percentage
  constraint catalog_items_pct_required
    check (default_pricing_mode = 'none' or default_pricing_pct is not null)
);
create index catalog_items_name_trgm on public.catalog_items using gin (name extensions.gin_trgm_ops);
create index catalog_items_type_idx on public.catalog_items (item_type) where is_active;

-- ---------------------------------------------------------------------
-- 3. package_components (bill of materials, ONE level – owner decision)
-- ---------------------------------------------------------------------
create table public.package_components (
  package_item_id   uuid not null references public.catalog_items (id) on delete cascade,
  component_item_id uuid not null references public.catalog_items (id),
  quantity          numeric(14,4) not null check (quantity > 0),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  primary key (package_item_id, component_item_id),
  check (package_item_id <> component_item_id)
);
create index package_components_component_idx on public.package_components (component_item_id);

-- The parent must be a package; a component must not be a package (no nesting).
create function private.check_package_component() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select item_type from public.catalog_items where id = new.package_item_id) <> 'package' then
    raise exception 'package_components: % is not a package', new.package_item_id
      using errcode = '23514', hint = 'not_a_package';
  end if;
  if (select item_type from public.catalog_items where id = new.component_item_id) = 'package' then
    raise exception 'package_components: a package cannot contain another package'
      using errcode = '23514', hint = 'nested_package';
  end if;
  return new;
end;
$$;
create trigger check_package_component before insert or update on public.package_components
  for each row execute function private.check_package_component();

-- Changing an item's type must not break the rule afterwards.
create function private.check_catalog_item_type() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.item_type = 'package' and new.item_type <> 'package'
     and exists (select 1 from public.package_components where package_item_id = new.id) then
    raise exception 'catalog_items: remove the components before changing the type of a package'
      using errcode = '23514', hint = 'package_has_components';
  end if;
  if new.item_type = 'package' and old.item_type <> 'package'
     and exists (select 1 from public.package_components where component_item_id = new.id) then
    raise exception 'catalog_items: an item used inside a package cannot become a package'
      using errcode = '23514', hint = 'nested_package';
  end if;
  return new;
end;
$$;
create trigger check_catalog_item_type before update of item_type on public.catalog_items
  for each row execute function private.check_catalog_item_type();

-- ---------------------------------------------------------------------
-- 4. labor_roles, labor_rates (validity periods must not overlap per role)
-- ---------------------------------------------------------------------
create table public.labor_roles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 100),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index labor_roles_name_uq on public.labor_roles (lower(name));

create table public.labor_rates (
  id              uuid primary key default gen_random_uuid(),
  role_id         uuid not null references public.labor_roles (id),
  cost_rate_cents bigint not null check (cost_rate_cents >= 0),
  bill_rate_cents bigint not null check (bill_rate_cents >= 0),
  valid_from      date not null,
  valid_to        date,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  check (valid_to is null or valid_to >= valid_from),
  constraint labor_rates_no_overlap exclude using gist (
    role_id with =,
    daterange(valid_from, valid_to, '[]') with &&
  )
);

-- ---------------------------------------------------------------------
-- 5. resources – cost rate = purchase cost / life hours + operating cost per hour
--    (BUSINESS_PROCESSES.md 5.3; cents, half up; same formula in src/core/calc/resource-rate.ts)
-- ---------------------------------------------------------------------
create table public.resources (
  id                            uuid primary key default gen_random_uuid(),
  name                          text not null check (length(btrim(name)) between 1 and 200),
  kind                          text check (length(kind) <= 50),
  purchase_cost_cents           bigint not null default 0 check (purchase_cost_cents >= 0),
  expected_life_hours           numeric(10,2) not null check (expected_life_hours > 0),
  operating_cost_per_hour_cents bigint not null default 0 check (operating_cost_per_hour_cents >= 0),
  -- nullif: the generated value is computed before the check runs; 0 must end in the
  -- check violation (23514), not in "division by zero"
  cost_rate_cents               bigint generated always as (
    round(purchase_cost_cents::numeric / nullif(expected_life_hours, 0))::bigint
      + operating_cost_per_hour_cents
  ) stored,
  bill_rate_cents               bigint check (bill_rate_cents >= 0),
  is_active                     boolean not null default true,
  created_at                    timestamptz not null default now(),
  created_by                    uuid references auth.users (id),
  updated_at                    timestamptz not null default now(),
  updated_by                    uuid
);

-- ---------------------------------------------------------------------
-- 6. Standard setup. Delete only where there is no is_active and nothing
--    refers to the row: units (FK restrict protects used units) and BOM rows.
-- ---------------------------------------------------------------------
select private.setup_admin_table(t)
from unnest(array['catalog_items','labor_roles','labor_rates','resources']) as t;
select private.setup_admin_table(t, true)
from unnest(array['units','package_components']) as t;
