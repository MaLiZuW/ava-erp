-- =====================================================================
-- Phase 3 – master data (1/3): customers, suppliers, their contacts,
-- customer machines (hidden behind feature flag service_cnc).
-- Source of truth: docs/DATABASE_SCHEMA.md section 4, approved phase-3 plan
-- (docs/steps/STEP-03-kmenove-data.md).
-- Conventions for every phase-3 table: audit columns + set_updated + log_change,
-- RLS with restrictive require_aal2, admin-only permissive policies, explicit grants,
-- money columns >= 0. Master data is never deleted (soft delete via is_active).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helper: the standard setup of an admin-managed table.
--    Runs only inside migrations (no grant to API roles).
-- ---------------------------------------------------------------------
create function private.setup_admin_table(p_table text, p_allow_delete boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('create trigger set_updated before insert or update on public.%I
                  for each row execute function private.set_updated()', p_table);
  execute format('create trigger log_change after insert or update or delete on public.%I
                  for each row execute function private.log_change()', p_table);

  execute format('alter table public.%I enable row level security', p_table);
  execute format($p$create policy require_aal2 on public.%I as restrictive to authenticated
                    using ((select auth.jwt() ->> 'aal') = 'aal2')
                    with check ((select auth.jwt() ->> 'aal') = 'aal2')$p$, p_table);
  execute format($p$create policy %I on public.%I for select to authenticated
                    using ((select private.has_role('admin')))$p$, p_table || '_admin_select', p_table);
  execute format($p$create policy %I on public.%I for insert to authenticated
                    with check ((select private.has_role('admin')))$p$, p_table || '_admin_insert', p_table);
  execute format($p$create policy %I on public.%I for update to authenticated
                    using ((select private.has_role('admin')))
                    with check ((select private.has_role('admin')))$p$, p_table || '_admin_update', p_table);

  execute format('revoke all on public.%I from anon', p_table);
  if p_allow_delete then
    execute format($p$create policy %I on public.%I for delete to authenticated
                      using ((select private.has_role('admin')))$p$, p_table || '_admin_delete', p_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', p_table);
  else
    execute format('grant select, insert, update on public.%I to authenticated', p_table);
  end if;
  execute format('grant all on public.%I to service_role', p_table);
end;
$$;
revoke all on function private.setup_admin_table(text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. customers
-- ---------------------------------------------------------------------
create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  kind               public.party_kind not null default 'company',
  name               text not null check (length(btrim(name)) between 1 and 200),
  ico                text check (ico ~ '^[0-9]{8}$'),
  dic                text check (dic ~ '^[0-9]{10}$'),
  ic_dph             text check (ic_dph ~ '^[A-Z]{2}[0-9A-Z]{2,13}$'),
  vat_payer          boolean not null default false,
  street             text check (length(street) <= 200),
  city               text check (length(city) <= 100),
  zip                text check (length(zip) <= 20),
  country            char(2) not null default 'SK' check (country ~ '^[A-Z]{2}$'),
  billing_email      text check (billing_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(billing_email) <= 254),
  peppol_id          text check (length(peppol_id) <= 100),
  payment_terms_days int check (payment_terms_days between 0 and 365),
  note               text check (length(note) <= 4000),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
create unique index customers_ico_uq on public.customers (ico) where ico is not null;
create index customers_name_trgm on public.customers using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 2. customer_contacts
-- ---------------------------------------------------------------------
create table public.customer_contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  full_name   text not null check (length(btrim(full_name)) between 1 and 200),
  position    text check (length(position) <= 100),
  email       text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  phone       text check (length(phone) <= 40),
  is_primary  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index customer_contacts_customer_idx on public.customer_contacts (customer_id);
create index customer_contacts_email_idx on public.customer_contacts (lower(email));
-- at most one primary (active) contact per customer
create unique index customer_contacts_primary_uq on public.customer_contacts (customer_id)
  where is_primary and is_active;

-- ---------------------------------------------------------------------
-- 3. customer_machines (feature flag service_cnc – hidden in the UI)
-- ---------------------------------------------------------------------
create table public.customer_machines (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers (id),
  manufacturer   text check (length(manufacturer) <= 100),
  model          text check (length(model) <= 100),
  serial_number  text check (length(serial_number) <= 100),
  year_built     int check (year_built between 1900 and 2100),
  control_system text check (length(control_system) <= 100),
  location       text check (length(location) <= 200),
  note           text check (length(note) <= 4000),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
create index customer_machines_customer_idx on public.customer_machines (customer_id);

-- ---------------------------------------------------------------------
-- 4. suppliers (same columns as customers + is_foreign, categories)
-- ---------------------------------------------------------------------
create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  kind               public.party_kind not null default 'company',
  name               text not null check (length(btrim(name)) between 1 and 200),
  ico                text check (ico ~ '^[0-9]{8}$'),
  dic                text check (dic ~ '^[0-9]{10}$'),
  ic_dph             text check (ic_dph ~ '^[A-Z]{2}[0-9A-Z]{2,13}$'),
  vat_payer          boolean not null default false,
  street             text check (length(street) <= 200),
  city               text check (length(city) <= 100),
  zip                text check (length(zip) <= 20),
  country            char(2) not null default 'SK' check (country ~ '^[A-Z]{2}$'),
  is_foreign         boolean generated always as (country <> 'SK') stored,
  categories         text[] not null default '{}',
  billing_email      text check (billing_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(billing_email) <= 254),
  peppol_id          text check (length(peppol_id) <= 100),
  payment_terms_days int check (payment_terms_days between 0 and 365),
  note               text check (length(note) <= 4000),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
create unique index suppliers_ico_uq on public.suppliers (ico) where ico is not null;
create index suppliers_name_trgm on public.suppliers using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 5. supplier_contacts
-- ---------------------------------------------------------------------
create table public.supplier_contacts (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  full_name   text not null check (length(btrim(full_name)) between 1 and 200),
  position    text check (length(position) <= 100),
  email       text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  phone       text check (length(phone) <= 40),
  is_primary  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index supplier_contacts_supplier_idx on public.supplier_contacts (supplier_id);
create index supplier_contacts_email_idx on public.supplier_contacts (lower(email));
create unique index supplier_contacts_primary_uq on public.supplier_contacts (supplier_id)
  where is_primary and is_active;

-- ---------------------------------------------------------------------
-- 6. Standard setup (triggers, RLS, policies, grants) – no delete (soft delete)
-- ---------------------------------------------------------------------
select private.setup_admin_table(t)
from unnest(array['customers','customer_contacts','customer_machines',
                  'suppliers','supplier_contacts']) as t;
