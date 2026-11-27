-- =====================================================================
-- Phase 3 – master data (3/3): content library for documents and settings
-- for reporting (overhead, income tax brackets, capacity, KPI targets).
-- Source of truth: docs/DATABASE_SCHEMA.md section 18, BUSINESS_PROCESSES.md
-- chapters 12, 14, 15, approved phase-3 plan. Owner decisions: money >= 0;
-- kpi_targets with id PK + unique NULLS NOT DISTINCT (division NULL = whole
-- company); NULLS NOT DISTINCT for overhead too. No tax values are seeded –
-- the owner enters them after checking with the accountant.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. documents: images (logo, content images) – PNG/JPEG/WebP up to 2 MB,
--    the same rule as the bucket and the frontend (defence in depth)
-- ---------------------------------------------------------------------
alter table public.documents
  add constraint documents_image_files check (
    category not in ('logo', 'content_image')
    or (mime_type in ('image/png', 'image/jpeg', 'image/webp') and size_bytes <= 2 * 1024 * 1024)
  );

-- ---------------------------------------------------------------------
-- 2. content_blocks (texts about the company, services per division / job type)
-- ---------------------------------------------------------------------
create table public.content_blocks (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null check (key ~ '^[a-z][a-zA-Z0-9_]{1,59}$'),
  division_id        uuid references public.divisions (id),
  job_type           public.job_type,
  title              text not null check (length(btrim(title)) between 1 and 200),
  body               text not null default '' check (length(body) <= 20000),
  image_document_ids uuid[] not null default '{}' check (cardinality(image_document_ids) <= 12),
  language           char(2) not null default 'sk' check (language ~ '^[a-z]{2}$'),
  is_active          boolean not null default true,
  version            int not null default 1 check (version >= 1),
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  unique (key, language)
);

-- version +1 whenever the text or the images change; images must be content images
create function private.content_block_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(new.image_document_ids) as img(id)
     where not exists (select 1 from public.documents d where d.id = img.id and d.category = 'content_image')
  ) then
    raise exception 'content_blocks: images must be documents of category content_image'
      using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version;
    if (new.title, new.body, new.image_document_ids) is distinct from
       (old.title, old.body, old.image_document_ids) then
      new.version := old.version + 1;
    end if;
  else
    new.version := 1;
  end if;
  return new;
end;
$$;
create trigger content_block_guard before insert or update on public.content_blocks
  for each row execute function private.content_block_guard();

-- ---------------------------------------------------------------------
-- 3. overhead_costs (monthly fixed costs; division NULL = shared)
-- ---------------------------------------------------------------------
create table public.overhead_costs (
  id           uuid primary key default gen_random_uuid(),
  month        date not null check (extract(day from month) = 1),
  division_id  uuid references public.divisions (id),
  category     text not null check (length(btrim(category)) between 1 and 100),
  amount_cents bigint not null check (amount_cents >= 0),
  note         text check (length(note) <= 1000),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint overhead_costs_month_division_category_uq
    unique nulls not distinct (month, division_id, category)
);
create index overhead_costs_month_idx on public.overhead_costs (month);

-- ---------------------------------------------------------------------
-- 4. income_tax_brackets (values entered by the owner, verified with the accountant)
-- ---------------------------------------------------------------------
create table public.income_tax_brackets (
  id                 uuid primary key default gen_random_uuid(),
  valid_from         date not null,
  valid_to           date,
  revenue_from_cents bigint not null check (revenue_from_cents >= 0),
  revenue_to_cents   bigint,
  rate_pct           numeric(7,4) not null check (rate_pct between 0 and 100),
  source_note        text check (length(source_note) <= 500),
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  check (valid_to is null or valid_to >= valid_from),
  check (revenue_to_cents is null or revenue_to_cents > revenue_from_cents),
  -- brackets valid at the same time must not cover the same revenue
  constraint income_tax_brackets_no_overlap exclude using gist (
    daterange(valid_from, valid_to, '[]') with &&,
    int8range(revenue_from_cents, revenue_to_cents, '[)') with &&
  )
);

-- ---------------------------------------------------------------------
-- 5. capacity_plans (available hours per person and month – utilisation KPI)
-- ---------------------------------------------------------------------
create table public.capacity_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  month           date not null check (extract(day from month) = 1),
  available_hours numeric(6,2) not null check (available_hours >= 0),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  unique (user_id, month)
);

-- ---------------------------------------------------------------------
-- 6. kpi_targets – deviation from the schema approved by the owner:
--    division_id NULL means "Spolu", so it cannot be part of a primary key
-- ---------------------------------------------------------------------
create table public.kpi_targets (
  id            uuid primary key default gen_random_uuid(),
  kpi_key       text not null check (kpi_key ~ '^[a-z][a-z0-9_]{1,59}$'),
  division_id   uuid references public.divisions (id),
  target_value  numeric not null,
  warning_value numeric,
  direction     text not null check (direction in ('higher_better', 'lower_better')),
  valid_from    date not null default current_date,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  constraint kpi_targets_key_division_from_uq
    unique nulls not distinct (kpi_key, division_id, valid_from),
  -- the warning threshold lies on the "worse" side of the target
  check (
    warning_value is null
    or (direction = 'higher_better' and warning_value <= target_value)
    or (direction = 'lower_better' and warning_value >= target_value)
  )
);

-- ---------------------------------------------------------------------
-- 7. Standard setup. Content blocks and tax brackets keep their history
--    (no delete); overhead, capacity and KPI targets may be removed.
-- ---------------------------------------------------------------------
select private.setup_admin_table(t)
from unnest(array['content_blocks','income_tax_brackets']) as t;
select private.setup_admin_table(t, true)
from unnest(array['overhead_costs','capacity_plans','kpi_targets']) as t;
