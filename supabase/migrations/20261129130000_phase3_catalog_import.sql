-- =====================================================================
-- Phase 3 – block K (D26): import of the catalog from XLSX / CSV, purchase price in a currency
-- with or without VAT, history of purchase prices, shared matching, EAN / GTIN with check digit.
-- Source: docs/analyzy/ANALYZA-AI-IMPORT-KATALOGU.md (approved 26. 11. 2026), owner decisions:
-- currencies EUR, CZK, PLN as configuration; with / without VAT – the rate is entered by the user;
-- EAN and supplier code optional; GTIN-8/12/13/14 with check digit (summary of 27. 11. 2026).
-- default_cost_cents stays the purchase price in EUR WITHOUT VAT (all calculations use it).
-- Exchange rate = units of the currency for 1 EUR (as published by ECB / NBS, e.g. 25,125 CZK).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. currencies (configuration – another currency = another row)
-- ---------------------------------------------------------------------
create table public.currencies (
  code       char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name       text not null check (length(btrim(name)) between 1 and 60),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.currencies (code, name, sort_order) values
  ('EUR', 'euro', 10), ('CZK', 'česká koruna', 20), ('PLN', 'poľský zlotý', 30);
select private.setup_admin_table('currencies', false);

-- ---------------------------------------------------------------------
-- 2. GTIN (EAN-8, UPC-A = GTIN-12, EAN-13, GTIN-14): digits + check digit (mod 10, weights 3/1)
-- ---------------------------------------------------------------------
create function private.gtin_valid(p text) returns boolean
language sql immutable strict parallel safe
set search_path = ''
as $$
  select p ~ '^[0-9]+$'
     and length(p) in (8, 12, 13, 14)
     and (10 - (select sum(substr(p, length(p) - i, 1)::int * case when i % 2 = 1 then 3 else 1 end)
                  from generate_series(1, length(p) - 1) as i) % 10) % 10
         = right(p, 1)::int;
$$;
grant execute on function private.gtin_valid(text) to authenticated;

-- EUR cents without VAT: original ÷ (1 + VAT) ÷ rate, rounded half up – exactly (integers only);
-- the same computation is in src/core/calc/purchase-price.ts
create function private.cost_to_eur_cents(p_original bigint, p_vat_pct numeric, p_rate numeric)
returns bigint
language sql immutable strict parallel safe
set search_path = ''
as $$
  select div(2 * (p_original::numeric * 10000 * 1000000) + (10000 + round(p_vat_pct * 100)) * round(p_rate * 1000000),
             2 * (10000 + round(p_vat_pct * 100)) * round(p_rate * 1000000))::bigint;
$$;
grant execute on function private.cost_to_eur_cents(bigint, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 3. import batches (needed by the catalog columns below)
-- ---------------------------------------------------------------------
create table public.import_batches (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid references public.suppliers (id),
  file_name      text not null check (length(btrim(file_name)) between 1 and 255),
  status         text not null default 'draft' check (status in ('draft','dry_run','applied','rolled_back')),
  -- currency, includes_vat, vat_rate_pct, fx_rate, fx_date (validated by the functions)
  options        jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  summary        jsonb not null default '{}'::jsonb,
  applied_at     timestamptz,
  applied_by     uuid references auth.users (id),
  rolled_back_at timestamptz,
  rolled_back_by uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
select private.setup_admin_table('import_batches', true);

-- an applied batch is history: only "Vrátiť dávku", never deleted (the e2e cleanup of the dev
-- project sets ava.import_apply in its own owner session; the app cannot set it)
create function private.guard_import_batch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status in ('applied', 'rolled_back')
     and current_setting('ava.import_apply', true) is distinct from 'on' then
    raise exception 'an applied import batch is never deleted' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger guard_import_batch before delete on public.import_batches
  for each row execute function private.guard_import_batch();

-- ---------------------------------------------------------------------
-- 4. catalog_items: supplier code, EAN, purchase price in a currency with / without VAT
-- ---------------------------------------------------------------------
alter table public.catalog_items
  add column supplier_item_code   text check (length(btrim(supplier_item_code)) between 1 and 60),
  add column ean                  text check (private.gtin_valid(ean)),
  add column cost_currency        char(3) not null default 'EUR' references public.currencies (code),
  add column cost_original_amount bigint check (cost_original_amount >= 0),
  add column cost_fx_rate         numeric(12,6) check (cost_fx_rate > 0),
  add column cost_fx_date         date,
  add column cost_includes_vat    boolean not null default false,
  add column cost_vat_rate_pct    numeric(5,2) check (cost_vat_rate_pct between 0 and 100),
  add column cost_updated_at      timestamptz,
  add column cost_source          text not null default 'manual' check (cost_source in ('manual','import','rollback')),
  add column cost_import_batch_id uuid references public.import_batches (id) on delete set null,
  add constraint catalog_items_vat_rate_required
    check (not cost_includes_vat or cost_vat_rate_pct is not null),
  add constraint catalog_items_fx_required
    check (cost_currency = 'EUR' or (cost_fx_rate is not null and cost_fx_date is not null and cost_original_amount is not null));

-- the same EAN only once (GTIN-12 and the same number as GTIN-13 / 14 are one product)
create unique index catalog_items_ean_uq on public.catalog_items (lpad(ean, 14, '0')) where ean is not null;
-- a supplier code only once per supplier (NULL supplier = one group)
create unique index catalog_items_supplier_code_uq on public.catalog_items
  (coalesce(default_supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(supplier_item_code)))
  where supplier_item_code is not null;

update public.catalog_items set cost_updated_at = updated_at;

-- the EUR price without VAT is always computed from the original price (one source of truth)
create function private.apply_purchase_price() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.supplier_item_code := nullif(btrim(new.supplier_item_code), '');
  new.ean := nullif(btrim(new.ean), '');
  if new.cost_currency = 'EUR' then
    new.cost_fx_rate := null;
    new.cost_fx_date := null;
  end if;
  if not new.cost_includes_vat then
    new.cost_vat_rate_pct := null;
  end if;
  if new.cost_original_amount is not null then
    if new.cost_includes_vat and new.cost_vat_rate_pct is null then
      raise exception 'a price with VAT needs the VAT rate' using errcode = '23514', hint = 'vat_rate';
    end if;
    if new.cost_currency <> 'EUR' and (new.cost_fx_rate is null or new.cost_fx_date is null) then
      raise exception 'a price in % needs the exchange rate and its date', new.cost_currency
        using errcode = '23514', hint = 'fx_rate';
    end if;
    new.default_cost_cents := private.cost_to_eur_cents(
      new.cost_original_amount,
      case when new.cost_includes_vat then new.cost_vat_rate_pct else 0 end,
      case when new.cost_currency = 'EUR' then 1 else new.cost_fx_rate end);
  end if;
  if tg_op = 'INSERT' then
    new.cost_updated_at := clock_timestamp();   -- two changes in one transaction differ
  elsif (new.default_cost_cents, new.cost_currency, new.cost_original_amount, new.cost_fx_rate, new.cost_fx_date,
         new.cost_includes_vat, new.cost_vat_rate_pct)
        is distinct from
        (old.default_cost_cents, old.cost_currency, old.cost_original_amount, old.cost_fx_rate, old.cost_fx_date,
         old.cost_includes_vat, old.cost_vat_rate_pct) then
    new.cost_updated_at := clock_timestamp();   -- two changes in one transaction differ
    -- a change without a new batch is a manual change
    if new.cost_import_batch_id is not distinct from old.cost_import_batch_id
       and new.cost_source is not distinct from old.cost_source then
      new.cost_source := 'manual';
      new.cost_import_batch_id := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger apply_purchase_price before insert or update on public.catalog_items
  for each row execute function private.apply_purchase_price();

-- ---------------------------------------------------------------------
-- 5. catalog_item_costs – history of purchase prices (append-only)
-- ---------------------------------------------------------------------
create table public.catalog_item_costs (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references public.catalog_items (id) on delete cascade,
  cost_cents       bigint not null check (cost_cents >= 0),
  currency         char(3) not null references public.currencies (code),
  original_amount  bigint check (original_amount >= 0),
  fx_rate          numeric(12,6),
  fx_date          date,
  includes_vat     boolean not null,
  vat_rate_pct     numeric(5,2),
  source           text not null check (source in ('manual','import','rollback')),
  import_batch_id  uuid references public.import_batches (id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
create index catalog_item_costs_item_idx on public.catalog_item_costs (item_id, created_at desc);
select private.setup_admin_table('catalog_item_costs', false);
revoke update on public.catalog_item_costs from authenticated;

create function private.record_purchase_price() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.cost_updated_at is distinct from old.cost_updated_at then
    insert into public.catalog_item_costs (item_id, cost_cents, currency, original_amount, fx_rate, fx_date,
                                           includes_vat, vat_rate_pct, source, import_batch_id)
    values (new.id, new.default_cost_cents, new.cost_currency, new.cost_original_amount, new.cost_fx_rate,
            new.cost_fx_date, new.cost_includes_vat, new.cost_vat_rate_pct, new.cost_source, new.cost_import_batch_id);
  end if;
  return null;
end;
$$;
create trigger record_purchase_price after insert or update on public.catalog_items
  for each row execute function private.record_purchase_price();

-- ---------------------------------------------------------------------
-- 6. import templates (mapping of columns per supplier) and batch rows
-- ---------------------------------------------------------------------
create table public.import_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 100),
  supplier_id uuid references public.suppliers (id) on delete cascade,
  mapping     jsonb not null check (jsonb_typeof(mapping) = 'object'),
  options     jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create unique index import_templates_name_uq on public.import_templates (lower(btrim(name)));
select private.setup_admin_table('import_templates', true);

-- rows are many: no change log per row (the batch is logged); RLS as everywhere
create table public.import_batch_rows (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references public.import_batches (id) on delete cascade,
  row_no         int not null check (row_no >= 1),
  raw            jsonb not null default '{}'::jsonb,
  -- name, supplier_item_code, ean, price (cents of the batch currency), unit_code, item_type, description
  parsed         jsonb not null default '{}'::jsonb,
  errors         jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  match          jsonb not null default '[]'::jsonb check (jsonb_typeof(match) = 'array'),
  -- the user's choice: null = automatic; 'create', 'skip', 'update' (with chosen_item_id)
  decision       text check (decision in ('create','skip','update')),
  chosen_item_id uuid references public.catalog_items (id) on delete set null,
  action         text check (action in ('create','update_cost','skip','choose','error')),
  result_item_id uuid references public.catalog_items (id) on delete set null,
  previous       jsonb,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  unique (batch_id, row_no),
  check (decision is distinct from 'update' or chosen_item_id is not null)
);
create trigger set_updated before insert or update on public.import_batch_rows
  for each row execute function private.set_updated();
alter table public.import_batch_rows enable row level security;
create policy require_aal2 on public.import_batch_rows as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2') with check ((select auth.jwt() ->> 'aal') = 'aal2');
create policy import_batch_rows_admin_select on public.import_batch_rows for select to authenticated
  using ((select private.has_role('admin')));
create policy import_batch_rows_admin_insert on public.import_batch_rows for insert to authenticated
  with check ((select private.has_role('admin')));
create policy import_batch_rows_admin_update on public.import_batch_rows for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
create policy import_batch_rows_admin_delete on public.import_batch_rows for delete to authenticated
  using ((select private.has_role('admin')));
revoke all on public.import_batch_rows from anon;
grant select, insert, update, delete on public.import_batch_rows to authenticated;
grant all on public.import_batch_rows to service_role;

-- rows of an applied batch are history
create function private.guard_import_rows() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  st text;
begin
  select status into st from public.import_batches
   where id = case when tg_op = 'DELETE' then old.batch_id else new.batch_id end;
  if st in ('applied', 'rolled_back') and current_setting('ava.import_apply', true) is distinct from 'on' then
    raise exception 'rows of an applied import batch cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger guard_import_rows before insert or update or delete on public.import_batch_rows
  for each row execute function private.guard_import_rows();

-- ---------------------------------------------------------------------
-- 7. matching (shared with the AI assistant of F3.5): supplier + code → EAN → similar name
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, description) values
  ('catalog_match_name_threshold', '0.5'::jsonb,
   'Import katalógu: od akej podobnosti názvu (0–1) sa položka ponúkne ako kandidát.')
on conflict (key) do nothing;

create function public.match_catalog_item(p_supplier_id uuid, p_supplier_code text, p_ean text, p_name text)
returns table (item_id uuid, name text, reason text, score real)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  threshold real := coalesce((select (s.value #>> '{}')::real from public.system_settings s
                               where s.key = 'catalog_match_name_threshold'), 0.5);
begin
  if nullif(btrim(p_supplier_code), '') is not null then
    return query
      select i.id, i.name, 'supplier_code'::text, 1::real from public.catalog_items i
       where coalesce(i.default_supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = coalesce(p_supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
         and lower(btrim(i.supplier_item_code)) = lower(btrim(p_supplier_code));
    if found then return; end if;
  end if;
  if nullif(btrim(p_ean), '') is not null then
    return query
      select i.id, i.name, 'ean'::text, 1::real from public.catalog_items i
       where i.ean is not null and lpad(i.ean, 14, '0') = lpad(btrim(p_ean), 14, '0');
    if found then return; end if;
  end if;
  if nullif(btrim(p_name), '') is not null then
    return query
      select i.id, i.name, 'name'::text, extensions.similarity(i.name, p_name) as sc
        from public.catalog_items i
       where i.item_type <> 'package'
         and extensions.similarity(i.name, p_name) >= threshold
       order by sc desc, i.name
       limit 5;
  end if;
end;
$$;
grant execute on function public.match_catalog_item(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. dry run, apply, roll back (one transaction each)
-- ---------------------------------------------------------------------
create function private.import_require_admin() returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' or not private.has_role('admin') then
    raise exception 'import: admin with two-factor sign-in required' using errcode = '42501';
  end if;
end;
$$;

-- batch options → checked values
create function private.import_options(p_options jsonb, out currency char(3), out includes_vat boolean,
                                       out vat_rate numeric, out fx_rate numeric, out fx_date date)
language plpgsql
stable
set search_path = ''
as $$
begin
  currency := upper(coalesce(p_options ->> 'currency', 'EUR'));
  includes_vat := coalesce((p_options ->> 'includes_vat')::boolean, false);
  vat_rate := (p_options ->> 'vat_rate_pct')::numeric;
  fx_rate := (p_options ->> 'fx_rate')::numeric;
  fx_date := (p_options ->> 'fx_date')::date;
  if not exists (select 1 from public.currencies c where c.code = currency and c.is_active) then
    raise exception 'import: unknown currency %', currency using errcode = '23514', hint = 'currency';
  end if;
  if includes_vat and (vat_rate is null or vat_rate < 0 or vat_rate > 100) then
    raise exception 'import: VAT rate required' using errcode = '23514', hint = 'vat_rate';
  end if;
  if currency <> 'EUR' and (fx_rate is null or fx_rate <= 0 or fx_date is null) then
    raise exception 'import: exchange rate and its date required' using errcode = '23514', hint = 'fx_rate';
  end if;
  if not includes_vat then vat_rate := null; end if;
  if currency = 'EUR' then fx_rate := null; fx_date := null; end if;
end;
$$;

create function public.dry_run_import_batch(p_batch_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.import_batches;
  o record;
  r public.import_batch_rows;
  errs jsonb;
  cand jsonb;
  act text;
  p jsonb;
  v_summary jsonb;
begin
  perform private.import_require_admin();
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'import batch % not found', p_batch_id using errcode = 'P0002';
  end if;
  if b.status not in ('draft', 'dry_run') then
    raise exception 'import batch is already applied' using errcode = '23514', hint = 'status';
  end if;
  select * into o from private.import_options(b.options);

  for r in select * from public.import_batch_rows where batch_id = p_batch_id order by row_no loop
    p := r.parsed;
    errs := '[]'::jsonb;
    -- the same checks as in the browser (src/features/catalog/import/rows.ts)
    if coalesce(btrim(p ->> 'name'), '') = '' then errs := errs || '"Chýba názov."'::jsonb;
    elsif length(btrim(p ->> 'name')) > 200 then errs := errs || '"Názov je dlhší ako 200 znakov."'::jsonb; end if;
    if (p ->> 'price') is null or (p ->> 'price') !~ '^[0-9]+$' then
      errs := errs || '"Chýba cena alebo nie je číslo."'::jsonb;
    end if;
    if nullif(p ->> 'ean', '') is not null and not private.gtin_valid(p ->> 'ean') then
      errs := errs || '"EAN/GTIN nie je platný (8, 12, 13 alebo 14 číslic s kontrolnou číslicou)."'::jsonb;
    end if;
    if nullif(p ->> 'supplier_item_code', '') is not null and length(btrim(p ->> 'supplier_item_code')) > 60 then
      errs := errs || '"Kód dodávateľa je dlhší ako 60 znakov."'::jsonb;
    end if;
    if not exists (select 1 from public.units u where u.code = coalesce(nullif(p ->> 'unit_code', ''), 'ks')) then
      errs := errs || '"Neznáma jednotka."'::jsonb;
    end if;
    if coalesce(nullif(p ->> 'item_type', ''), 'goods') not in ('goods','service','labor','resource') then
      errs := errs || '"Neznámy typ položky (balíček sa importom nezakladá)."'::jsonb;
    end if;
    -- the same supplier code or EAN twice in one file
    if nullif(p ->> 'supplier_item_code', '') is not null and exists (
         select 1 from public.import_batch_rows x where x.batch_id = p_batch_id and x.row_no < r.row_no
            and lower(btrim(x.parsed ->> 'supplier_item_code')) = lower(btrim(p ->> 'supplier_item_code'))) then
      errs := errs || '"Kód dodávateľa je v súbore viackrát."'::jsonb;
    end if;
    if nullif(p ->> 'ean', '') is not null and exists (
         select 1 from public.import_batch_rows x where x.batch_id = p_batch_id and x.row_no < r.row_no
            and lpad(x.parsed ->> 'ean', 14, '0') = lpad(p ->> 'ean', 14, '0')) then
      errs := errs || '"EAN je v súbore viackrát."'::jsonb;
    end if;

    cand := coalesce((select jsonb_agg(jsonb_build_object('item_id', m.item_id, 'name', m.name,
                                                           'reason', m.reason, 'score', round(m.score::numeric, 2)))
                        from public.match_catalog_item(b.supplier_id, p ->> 'supplier_item_code',
                                                       p ->> 'ean', p ->> 'name') m), '[]'::jsonb);
    if jsonb_array_length(errs) > 0 then
      act := 'error';
    elsif r.decision = 'skip' then
      act := 'skip';
    elsif r.decision = 'create' then
      act := 'create';
    elsif r.decision = 'update' then
      act := 'update_cost';
    elsif jsonb_array_length(cand) = 0 then
      act := 'create';
    elsif jsonb_array_length(cand) = 1 and (cand -> 0 ->> 'reason') in ('supplier_code', 'ean') then
      act := 'update_cost';
    elsif jsonb_array_length(cand) = 1 and (cand -> 0 ->> 'score')::numeric >= 1 then
      act := 'update_cost';   -- the very same name
    else
      act := 'choose';        -- several candidates or only a similar name: the user decides
    end if;
    update public.import_batch_rows
       set errors = errs, match = cand, action = act,
           chosen_item_id = case
             when act = 'update_cost' and r.decision is null then (cand -> 0 ->> 'item_id')::uuid
             when act = 'update_cost' then r.chosen_item_id
             else r.chosen_item_id end
     where id = r.id;
  end loop;

  select jsonb_build_object(
           'rows', count(*),
           'create', count(*) filter (where action = 'create'),
           'update_cost', count(*) filter (where action = 'update_cost'),
           'skip', count(*) filter (where action = 'skip'),
           'choose', count(*) filter (where action = 'choose'),
           'error', count(*) filter (where action = 'error'))
    into v_summary
    from public.import_batch_rows where batch_id = p_batch_id;
  update public.import_batches set status = 'dry_run', summary = v_summary where id = p_batch_id;
  return v_summary;
end;
$$;
grant execute on function public.dry_run_import_batch(uuid) to authenticated;

create function public.apply_import_batch(p_batch_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.import_batches;
  o record;
  r public.import_batch_rows;
  v_summary jsonb;
  new_id uuid;
  it public.catalog_items;
begin
  perform private.import_require_admin();
  v_summary := public.dry_run_import_batch(p_batch_id);   -- current state of the catalog
  if (v_summary ->> 'choose')::int > 0 then
    raise exception 'import: % rows wait for a decision', v_summary ->> 'choose'
      using errcode = '23514', hint = 'unresolved';
  end if;
  select * into b from public.import_batches where id = p_batch_id for update;
  select * into o from private.import_options(b.options);

  for r in select * from public.import_batch_rows
            where batch_id = p_batch_id and action in ('create', 'update_cost') order by row_no loop
    if r.action = 'create' then
      insert into public.catalog_items (name, item_type, unit_code, default_supplier_id, supplier_item_code, ean,
                                        description, cost_currency, cost_original_amount, cost_fx_rate, cost_fx_date,
                                        cost_includes_vat, cost_vat_rate_pct, cost_source, cost_import_batch_id)
      values (btrim(r.parsed ->> 'name'),
              coalesce(nullif(r.parsed ->> 'item_type', ''), 'goods')::public.item_type,
              coalesce(nullif(r.parsed ->> 'unit_code', ''), 'ks'),
              b.supplier_id,
              nullif(btrim(r.parsed ->> 'supplier_item_code'), ''),
              nullif(btrim(r.parsed ->> 'ean'), ''),
              nullif(btrim(r.parsed ->> 'description'), ''),
              o.currency, (r.parsed ->> 'price')::bigint, o.fx_rate, o.fx_date, o.includes_vat, o.vat_rate,
              'import', p_batch_id)
      returning id into new_id;
    else
      select * into it from public.catalog_items where id = r.chosen_item_id for update;
      if not found then
        raise exception 'import: chosen item no longer exists (row %)', r.row_no using errcode = 'P0002';
      end if;
      new_id := it.id;
      update public.import_batch_rows
         set previous = jsonb_build_object(
               'default_cost_cents', it.default_cost_cents, 'cost_currency', it.cost_currency,
               'cost_original_amount', it.cost_original_amount, 'cost_fx_rate', it.cost_fx_rate,
               'cost_fx_date', it.cost_fx_date, 'cost_includes_vat', it.cost_includes_vat,
               'cost_vat_rate_pct', it.cost_vat_rate_pct, 'cost_source', it.cost_source,
               'cost_import_batch_id', it.cost_import_batch_id,
               'supplier_item_code', it.supplier_item_code, 'ean', it.ean)
       where id = r.id;
      update public.catalog_items
         set cost_currency = o.currency, cost_original_amount = (r.parsed ->> 'price')::bigint,
             cost_fx_rate = o.fx_rate, cost_fx_date = o.fx_date, cost_includes_vat = o.includes_vat,
             cost_vat_rate_pct = o.vat_rate, cost_source = 'import', cost_import_batch_id = p_batch_id,
             -- empty identifiers are filled in, existing ones are kept
             supplier_item_code = coalesce(supplier_item_code, nullif(btrim(r.parsed ->> 'supplier_item_code'), '')),
             ean = coalesce(ean, nullif(btrim(r.parsed ->> 'ean'), ''))
       where id = it.id;
    end if;
    update public.import_batch_rows set result_item_id = new_id where id = r.id;
  end loop;

  update public.import_batches
     set status = 'applied', applied_at = now(), applied_by = auth.uid(), summary = v_summary
   where id = p_batch_id;
  return v_summary;
end;
$$;
grant execute on function public.apply_import_batch(uuid) to authenticated;

-- an item is "in use" when a quote or a package needs it (quotes arrive in F4 – extend then)
create function private.catalog_item_in_use(p_item_id uuid) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.package_components pc
                  where pc.component_item_id = p_item_id or pc.package_item_id = p_item_id);
$$;

-- "Vrátiť dávku": created items are removed, updated prices return to the previous value.
-- security definer: admins cannot delete catalog items otherwise (no delete policy).
create function public.rollback_import_batch(p_batch_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.import_batches;
  r public.import_batch_rows;
  removed int := 0;
  restored int := 0;
begin
  perform private.import_require_admin();
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'import batch % not found', p_batch_id using errcode = 'P0002';
  end if;
  if b.status <> 'applied' then
    raise exception 'only an applied batch can be rolled back' using errcode = '23514', hint = 'status';
  end if;
  -- refuse when a later change or a use of the items exists
  for r in select * from public.import_batch_rows where batch_id = p_batch_id and result_item_id is not null loop
    if not exists (select 1 from public.catalog_items i
                    where i.id = r.result_item_id and i.cost_import_batch_id = p_batch_id) then
      raise exception 'row %: the price was changed after this batch', r.row_no
        using errcode = '23514', hint = 'newer_change';
    end if;
    if r.action = 'create' and private.catalog_item_in_use(r.result_item_id) then
      raise exception 'row %: the item is already used (package or quote)', r.row_no
        using errcode = '23514', hint = 'in_use';
    end if;
  end loop;

  perform set_config('ava.import_apply', 'on', true);
  for r in select * from public.import_batch_rows where batch_id = p_batch_id and result_item_id is not null loop
    if r.action = 'create' then
      delete from public.catalog_items where id = r.result_item_id;
      removed := removed + 1;
    else
      update public.catalog_items
         set cost_currency = r.previous ->> 'cost_currency',
             cost_original_amount = (r.previous ->> 'cost_original_amount')::bigint,
             default_cost_cents = (r.previous ->> 'default_cost_cents')::bigint,
             cost_fx_rate = (r.previous ->> 'cost_fx_rate')::numeric,
             cost_fx_date = (r.previous ->> 'cost_fx_date')::date,
             cost_includes_vat = (r.previous ->> 'cost_includes_vat')::boolean,
             cost_vat_rate_pct = (r.previous ->> 'cost_vat_rate_pct')::numeric,
             cost_source = 'rollback',
             cost_import_batch_id = (r.previous ->> 'cost_import_batch_id')::uuid,
             supplier_item_code = r.previous ->> 'supplier_item_code',
             ean = r.previous ->> 'ean'
       where id = r.result_item_id;
      restored := restored + 1;
    end if;
  end loop;
  update public.import_batches
     set status = 'rolled_back', rolled_back_at = now(), rolled_back_by = auth.uid()
   where id = p_batch_id;
  return jsonb_build_object('removed', removed, 'restored', restored);
end;
$$;
revoke all on function public.rollback_import_batch(uuid) from public, anon;
grant execute on function public.rollback_import_batch(uuid) to authenticated;
