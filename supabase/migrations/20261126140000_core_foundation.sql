-- =====================================================================
-- Phase 1 – core foundation
-- Source of truth: docs/DATABASE_SCHEMA.md (sections 0, 1, 2, 14, 15)
--                  docs/ARCHITECTURE_CORE.md (document core)
-- Contains: extensions, schema private, enums, system tables, core
-- functions (set_updated, log_change, has_role, next_document_number,
-- transition, block_direct_status_update) and RLS for every table.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
-- authenticated needs USAGE so that RLS policies can call private.has_role().
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- 1. Enums (DATABASE_SCHEMA.md section 1; doc_type includes NZ from section 18)
-- ---------------------------------------------------------------------
create type public.app_role             as enum ('admin','manager','accountant','external');
create type public.division_code        as enum ('AVENG','AGENCY');
create type public.job_type             as enum ('ENG','EVENT','PROMO','SEASON','SERVICE');
create type public.party_kind           as enum ('company','person');
create type public.inquiry_source       as enum ('email','phone','web','personal','other');
create type public.inquiry_status       as enum ('new','in_progress','waiting_customer','ready_for_costing','closed','rejected');
create type public.quote_version_status as enum ('draft','pending_approval','approved','sent','accepted','rejected','expired','superseded');
create type public.item_type            as enum ('goods','external_service','labor','resource','package','other');
create type public.pricing_mode         as enum ('none','margin','markup');
create type public.job_status           as enum ('received','confirmed','planning','in_progress','ready_for_delivery','delivered','invoiced','closed','cancelled');
create type public.visual_status        as enum ('draft','sent','approved','rejected');
create type public.supplier_rfq_status  as enum ('draft','sent','quoted','selected','closed');
create type public.po_status            as enum ('draft','sent','confirmed','partially_received','received','cancelled');
create type public.delivery_doc_kind    as enum ('delivery_note','handover_protocol','service_report');
create type public.delivery_doc_status  as enum ('draft','issued','confirmed','cancelled');
create type public.invoice_kind         as enum ('invoice','proforma','credit_note');
create type public.invoice_status       as enum ('draft','issued','sent','partially_paid','paid','overdue','cancelled');
create type public.received_inv_status  as enum ('received','verified','approved_for_payment','paid','disputed');
create type public.received_inv_source  as enum ('manual_pdf','xml_import','peppol_api');
create type public.payment_direction    as enum ('incoming','outgoing');
create type public.task_status          as enum ('todo','in_progress','done','blocked');
create type public.email_direction      as enum ('inbound','outbound');
-- DOP inquiry, CP quotation, ZAK job, OD supplier order, PRI goods receipt, DL delivery document,
-- FA invoice, ZF proforma, DB credit note, RFQ supplier inquiry, NZ nonconformity
create type public.doc_type             as enum ('DOP','CP','ZAK','OD','PRI','DL','FA','ZF','DB','RFQ','NZ');

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  legal_name       text not null,
  brand_name       text not null default 'Add Value Agency',
  ico              text,
  dic              text,
  ic_dph           text,                              -- null = not a VAT payer
  vat_payer        boolean not null default false,
  street           text,
  city             text,
  zip              text,
  country          text default 'SK',
  registry_entry   text,                              -- commercial register text for documents
  iban             text,
  bank_name        text,
  swift            text,
  email            text,
  phone            text,
  web              text,
  logo_document_id uuid,                              -- FK to documents is added when that table exists
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
-- exactly one company row (AV-agency, s.r.o.)
create unique index companies_single_row on public.companies ((true));

create table public.divisions (
  id         uuid primary key default gen_random_uuid(),
  code       public.division_code not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (user_id, role)
);

create table public.feature_flags (
  key        text primary key,
  enabled    boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table public.number_series (
  doc_type    public.doc_type not null,
  year        int not null check (year between 2000 and 2999),
  prefix      text not null,
  next_number int not null default 1 check (next_number >= 1),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (doc_type, year)
);

-- Document core: allowed status transitions are DATA (ARCHITECTURE_CORE.md section 2).
create table public.status_transitions (
  entity_table  text not null,                         -- 'quotation_versions', 'jobs', 'invoices' ...
  from_status   text not null,
  to_status     text not null,
  label_sk      text not null,                         -- label of the "next step" button
  is_primary    boolean not null default false,        -- main button in the HERO tile
  required_role public.app_role not null default 'admin',
  guard_fn      text,                                  -- name of a private.<fn>(uuid) returns boolean
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  primary key (entity_table, from_status, to_status),
  check (from_status <> to_status),
  check (guard_fn is null or guard_fn ~ '^[a-z_][a-z0-9_]*$')
);

-- Append-only audit trail. record_id is null for tables without a uuid "id" key
-- (feature_flags, system_settings, user_roles ...) – the key is then inside old_data/new_data.
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid,
  action      text not null check (action in ('insert','update','delete','transition')),
  old_data    jsonb,
  new_data    jsonb,
  from_status text,
  to_status   text,
  note        text,
  actor       uuid,                                    -- auth.uid(); intentionally no FK (audit must survive user removal)
  at          timestamptz not null default now()
);
create index activity_logs_record_idx on public.activity_logs (table_name, record_id);
create index activity_logs_at_idx on public.activity_logs (at);

-- ---------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------

-- 3.1 audit columns -----------------------------------------------------
create function private.set_updated() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- 3.2 roles ---------------------------------------------------------------
create function private.has_role(p_role public.app_role) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and p.is_active
  );
$$;

-- 3.3 audit log -------------------------------------------------------------
create function private.log_change() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
begin
  -- transition() writes its own audit row
  if coalesce(current_setting('app.in_transition', true), 'off') = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
    -- ignore updates that change nothing but the audit columns
    if (v_new - 'updated_at' - 'updated_by') = (v_old - 'updated_at' - 'updated_by') then
      return null;
    end if;
  else
    v_old := to_jsonb(old);
    v_row := v_old;
  end if;

  insert into public.activity_logs (table_name, record_id, action, old_data, new_data, actor)
  values (tg_table_name, nullif(v_row ->> 'id', '')::uuid, lower(tg_op), v_old, v_new, auth.uid());
  return null;
end;
$$;

create function private.block_log_mutation() returns trigger
language plpgsql
as $$
begin
  raise exception 'activity_logs is append-only' using errcode = '42501';
end;
$$;

create trigger activity_logs_append_only
  before update or delete on public.activity_logs
  for each row execute function private.block_log_mutation();
create trigger activity_logs_no_truncate
  before truncate on public.activity_logs
  for each statement execute function private.block_log_mutation();

-- 3.4 profile for every new auth user -----------------------------------------
create function private.handle_new_user() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- 3.5 document numbering --------------------------------------------------------
-- Format PREFIX-YYYY-NNNN (4 digits, 5 digits above 9999). Row lock makes it gap-free and
-- safe under concurrency. A missing series for a new year is created automatically.
-- NOT callable through the API: only trigger functions (security definer) call it.
create function public.next_document_number(p_doc_type public.doc_type, p_year int default null)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_year   int := coalesce(p_year, extract(year from (now() at time zone 'Europe/Bratislava'))::int);
  v_prefix text;
  v_n      int;
begin
  insert into public.number_series (doc_type, year, prefix)
  values (p_doc_type, v_year, p_doc_type::text)
  on conflict do nothing;

  select ns.prefix, ns.next_number
    into v_prefix, v_n
    from public.number_series ns
   where ns.doc_type = p_doc_type and ns.year = v_year
     for update;

  update public.number_series ns
     set next_number = ns.next_number + 1
   where ns.doc_type = p_doc_type and ns.year = v_year;

  return v_prefix || '-' || v_year::text || '-'
         || case when v_n > 9999 then v_n::text else lpad(v_n::text, 4, '0') end;
end;
$$;

-- 3.6 direct status updates are forbidden -----------------------------------------
-- Attach to every table with a "status" column:
--   create trigger block_direct_status_update before update on public.<t>
--     for each row execute function private.block_direct_status_update();
create function private.block_direct_status_update() returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if coalesce(current_setting('app.in_transition', true), 'off') <> 'on'
       or current_user in ('anon', 'authenticated') then
      raise exception 'status can only be changed through public.transition()'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- 3.7 transition(): the ONLY way to change a document status ------------------------
create function public.transition(
  p_entity_table text,
  p_id           uuid,
  p_to_status    text,
  p_note         text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid     uuid := auth.uid();
  v_rel     text;
  v_coltype text;
  v_from    text;
  v_rule    public.status_transitions%rowtype;
  v_ok      boolean;
begin
  -- security definer bypasses RLS, so the aal2 requirement is enforced here as well
  if v_uid is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'transition_forbidden: authenticated aal2 session required' using errcode = '42501';
  end if;

  -- only tables registered in status_transitions can be touched (guards dynamic SQL)
  if not exists (select 1 from public.status_transitions st where st.entity_table = p_entity_table) then
    raise exception 'transition_unknown_entity: %', p_entity_table using errcode = '22023';
  end if;
  v_rel := format('public.%I', p_entity_table);
  if to_regclass(v_rel) is null then
    raise exception 'transition_unknown_entity: table % does not exist', p_entity_table using errcode = '22023';
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_coltype
    from pg_attribute a
   where a.attrelid = to_regclass(v_rel)
     and a.attname = 'status'
     and not a.attisdropped;
  if v_coltype is null then
    raise exception 'transition_unknown_entity: % has no status column', p_entity_table using errcode = '22023';
  end if;

  execute format('select status::text from %s where id = $1 for update', v_rel)
     into v_from using p_id;
  if v_from is null then
    raise exception 'transition_not_found: % %', p_entity_table, p_id using errcode = 'P0002';
  end if;

  select * into v_rule
    from public.status_transitions st
   where st.entity_table = p_entity_table
     and st.from_status = v_from
     and st.to_status = p_to_status;
  if not found then
    raise exception 'transition_not_allowed: % -> % on %', v_from, p_to_status, p_entity_table
      using errcode = 'P0001';
  end if;

  if not (private.has_role(v_rule.required_role) or private.has_role('admin')) then
    raise exception 'transition_forbidden: role % required', v_rule.required_role using errcode = '42501';
  end if;

  if v_rule.guard_fn is not null then
    if to_regprocedure(format('private.%I(uuid)', v_rule.guard_fn)) is null then
      raise exception 'transition_guard_missing: private.%(uuid)', v_rule.guard_fn using errcode = 'P0001';
    end if;
    execute format('select private.%I($1)', v_rule.guard_fn) into v_ok using p_id;
    if v_ok is not true then
      raise exception 'transition_guard_failed: %', v_rule.guard_fn using errcode = 'P0001';
    end if;
  end if;

  perform set_config('app.in_transition', 'on', true);
  execute format('update public.%I set status = $1::%s where id = $2', p_entity_table, v_coltype)
    using p_to_status, p_id;
  perform set_config('app.in_transition', 'off', true);

  insert into public.activity_logs (table_name, record_id, action, from_status, to_status, note, actor)
  values (p_entity_table, p_id, 'transition', v_from, p_to_status, p_note, v_uid);

  return jsonb_build_object(
    'from_status', v_from,
    'to_status',   p_to_status,
    'next_steps',  coalesce((
      select jsonb_agg(
               jsonb_build_object('to_status', st.to_status, 'label_sk', st.label_sk, 'is_primary', st.is_primary)
               order by st.is_primary desc, st.label_sk)
        from public.status_transitions st
       where st.entity_table = p_entity_table
         and st.from_status = p_to_status
         and (private.has_role(st.required_role) or private.has_role('admin'))
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- audit columns on every table except the append-only log
  foreach t in array array['companies','divisions','profiles','user_roles','feature_flags',
                           'system_settings','number_series','status_transitions']
  loop
    execute format('create trigger set_updated before insert or update on public.%I
                    for each row execute function private.set_updated()', t);
  end loop;

  -- change log (number_series is deliberately excluded: numbering is traceable from documents)
  foreach t in array array['companies','divisions','profiles','user_roles','feature_flags',
                           'system_settings','status_transitions']
  loop
    execute format('create trigger log_change after insert or update or delete on public.%I
                    for each row execute function private.log_change()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Row Level Security (DATABASE_SCHEMA.md section 14)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['companies','divisions','profiles','user_roles','feature_flags',
                           'system_settings','number_series','status_transitions','activity_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- restrictive: nothing works without a second factor, whatever the other policies say
    execute format($p$create policy require_aal2 on public.%I as restrictive to authenticated
                      using ((select auth.jwt() ->> 'aal') = 'aal2')
                      with check ((select auth.jwt() ->> 'aal') = 'aal2')$p$, t);
  end loop;
end;
$$;

-- companies: admin only
create policy companies_admin_select on public.companies for select to authenticated
  using ((select private.has_role('admin')));
create policy companies_admin_insert on public.companies for insert to authenticated
  with check ((select private.has_role('admin')));
create policy companies_admin_update on public.companies for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- divisions: readable by every signed-in (aal2) user, writable by admin
create policy divisions_select on public.divisions for select to authenticated using (true);
create policy divisions_admin_insert on public.divisions for insert to authenticated
  with check ((select private.has_role('admin')));
create policy divisions_admin_update on public.divisions for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- profiles: own row or admin
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_role('admin')));
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check ((select private.has_role('admin')));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- user_roles: own roles (UI needs them) or admin; only admin assigns
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('admin')));
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
  with check ((select private.has_role('admin')));
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
  using ((select private.has_role('admin')));

-- feature_flags: readable by all (UI hides features), writable by admin
create policy feature_flags_select on public.feature_flags for select to authenticated using (true);
create policy feature_flags_admin_insert on public.feature_flags for insert to authenticated
  with check ((select private.has_role('admin')));
create policy feature_flags_admin_update on public.feature_flags for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- system_settings: admin only
create policy system_settings_admin_select on public.system_settings for select to authenticated
  using ((select private.has_role('admin')));
create policy system_settings_admin_insert on public.system_settings for insert to authenticated
  with check ((select private.has_role('admin')));
create policy system_settings_admin_update on public.system_settings for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- number_series: admin may read; rows are changed only by next_document_number()
create policy number_series_admin_select on public.number_series for select to authenticated
  using ((select private.has_role('admin')));

-- status_transitions: readable by all (UI renders the next step); changed only by migrations
create policy status_transitions_select on public.status_transitions for select to authenticated
  using (true);

-- activity_logs: admin may read; written only by security definer triggers; never changed
create policy activity_logs_admin_select on public.activity_logs for select to authenticated
  using ((select private.has_role('admin')));

-- ---------------------------------------------------------------------
-- 6. Privileges
-- ---------------------------------------------------------------------
-- Explicit grants: this migration must not depend on Supabase's default privileges
-- (new projects may require explicit GRANTs). RLS decides what is actually visible/writable.
-- Convention: every later migration that creates a table grants privileges the same way.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke insert, update, delete, truncate on public.activity_logs from authenticated;
revoke insert, update, delete, truncate on public.number_series from authenticated;
revoke insert, update, delete, truncate on public.status_transitions from authenticated;

-- private functions are not callable by API roles, except has_role() used inside RLS policies
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;

revoke all on function public.transition(text, uuid, text, text) from public, anon;
grant execute on function public.transition(text, uuid, text, text) to authenticated;

revoke all on function public.next_document_number(public.doc_type, int) from public, anon, authenticated;
