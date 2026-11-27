-- =====================================================================
-- Phase 3 / block I – recurring overhead and periodic data review
-- (owner's points 12 and 13). Owner decision: recurring overhead is valid by
-- whole months; a change of the amount is a new version from a month, the old
-- one is closed the day before – past months are never rewritten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. recurring_overheads (overhead_costs stays for one-off items and corrections)
-- ---------------------------------------------------------------------
create table public.recurring_overheads (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (length(btrim(category)) between 1 and 100),
  division_id  uuid references public.divisions (id),
  amount_cents bigint not null check (amount_cents >= 0),
  frequency    text not null check (frequency in ('monthly','quarterly','yearly')),
  valid_from   date not null check (extract(day from valid_from) = 1),
  valid_to     date check (valid_to = (date_trunc('month', valid_to) + interval '1 month - 1 day')::date),
  note         text check (length(note) <= 1000),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  check (valid_to is null or valid_to >= valid_from),
  -- the same cost (category + division, NULL = whole company) never twice in the same period
  constraint recurring_overheads_no_overlap exclude using gist (
    (lower(category)) with =,
    (coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    daterange(valid_from, valid_to, '[]') with &&
  )
);

-- A version that already applied in a past month keeps its amount, frequency, category,
-- division and start – a change is a new version (revise_recurring_overhead).
create function private.guard_recurring_overhead() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.valid_from < date_trunc('month', current_date)::date
     and (new.amount_cents, new.frequency, lower(new.category), new.division_id, new.valid_from)
         is distinct from (old.amount_cents, old.frequency, lower(old.category), old.division_id, old.valid_from) then
    raise exception 'recurring_overheads: a version used in past months cannot be rewritten – create a new version'
      using errcode = '23514', hint = 'past_version';
  end if;
  return new;
end;
$$;
create trigger guard_recurring_overhead before update on public.recurring_overheads
  for each row execute function private.guard_recurring_overhead();

-- new version from a month (first day); the previous one ends the day before
create function public.revise_recurring_overhead(
  p_id uuid, p_amount_cents bigint, p_effective_from date, p_note text default null, p_frequency text default null
) returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_old public.recurring_overheads%rowtype;
  v_new uuid;
begin
  select * into v_old from public.recurring_overheads where id = p_id for update;
  if not found then
    raise exception 'recurring_overheads: % not found', p_id using errcode = 'P0002';
  end if;
  if extract(day from p_effective_from) <> 1
     or p_effective_from <= v_old.valid_from
     or (v_old.valid_to is not null and p_effective_from > v_old.valid_to) then
    raise exception 'recurring_overheads: the change must start on the first day of a month within the version'
      using errcode = '23514', hint = 'bad_effective_from';
  end if;
  update public.recurring_overheads set valid_to = p_effective_from - 1 where id = p_id;
  insert into public.recurring_overheads (category, division_id, amount_cents, frequency, valid_from, valid_to, note)
  values (v_old.category, v_old.division_id, p_amount_cents, coalesce(p_frequency, v_old.frequency),
          p_effective_from, v_old.valid_to, coalesce(p_note, v_old.note))
  returning id into v_new;
  return v_new;
end;
$$;
revoke all on function public.revise_recurring_overhead(uuid, bigint, date, text, text) from public, anon;
grant execute on function public.revise_recurring_overhead(uuid, bigint, date, text, text) to authenticated;

-- monthly share in cents: quarterly ÷ 3, yearly ÷ 12; the remaining cents go to the first months
-- of each period (counted from valid_from), so a whole period adds up exactly.
create function private.overhead_month_share(p_amount bigint, p_frequency text, p_valid_from date, p_month date)
returns bigint
language sql immutable
set search_path = ''
as $$
  with p as (
    select case p_frequency when 'quarterly' then 3 when 'yearly' then 12 else 1 end as n,
           ((extract(year from p_month) - extract(year from p_valid_from)) * 12
             + extract(month from p_month) - extract(month from p_valid_from))::int as k
  )
  select p_amount / n + case when (k % n) < (p_amount % n) then 1 else 0 end from p;
$$;
-- also callable from the UI preview tests (pure function, no data)
grant usage on schema private to authenticated;
grant execute on function private.overhead_month_share(bigint, text, date, date) to authenticated;

-- months × division × category: recurring (share of the month) + one-off items (overhead_costs)
create view public.v_overhead_monthly with (security_invoker = true) as
with months as (
  select m::date as month
  from generate_series(date_trunc('month', current_date) - interval '36 months',
                       date_trunc('month', current_date) + interval '12 months',
                       interval '1 month') as m
)
select months.month, r.division_id, r.category, 'recurring'::text as source,
       private.overhead_month_share(r.amount_cents, r.frequency, r.valid_from, months.month) as amount_cents,
       r.amount_cents as original_amount_cents, r.frequency, r.id as recurring_id, null::uuid as overhead_cost_id
from public.recurring_overheads r
join months on months.month between r.valid_from and coalesce(r.valid_to, 'infinity'::date)
union all
select o.month, o.division_id, o.category, 'one_off', o.amount_cents, o.amount_cents, null, null, o.id
from public.overhead_costs o;

-- ---------------------------------------------------------------------
-- 2. Periodic review of data (data attestation) – one table for all entities
-- ---------------------------------------------------------------------
create table public.data_review_types (
  entity_table    text primary key check (entity_table ~ '^[a-z_]{2,60}$'),
  label           text not null check (length(btrim(label)) between 1 and 100),
  interval_months int not null default 12 check (interval_months between 1 and 120),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
insert into public.data_review_types (entity_table, label) values
  ('recurring_overheads', 'Opakovaná réžia'),
  ('labor_rates',         'Sadzby rolí'),
  ('resources',           'Technika a vybavenie'),
  ('income_tax_brackets', 'Pásma dane z príjmov'),
  ('work_patterns',       'Týždenný vzor kapacity'),
  ('companies',           'Údaje firmy');

create table public.data_reviews (
  id               uuid primary key default gen_random_uuid(),
  entity_table     text not null references public.data_review_types (entity_table),
  entity_id        uuid not null,
  interval_months  int not null check (interval_months between 1 and 120),
  last_reviewed_at timestamptz,
  last_reviewed_by uuid references public.profiles (id) on delete set null,
  next_review_at   date not null,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  unique (entity_table, entity_id)
);

-- insert → review due after the interval; a real change = edited + confirmed;
-- delete → the review goes too. Closing a version (only valid_to) is not a review.
create function private.track_data_review() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_type public.data_review_types%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  select * into v_type from public.data_review_types where entity_table = tg_table_name and is_active;
  if not found then
    return null;
  end if;
  if tg_op = 'DELETE' then
    delete from public.data_reviews where entity_table = tg_table_name and entity_id = old.id;
    return null;
  end if;
  if tg_op = 'INSERT' then
    insert into public.data_reviews (entity_table, entity_id, interval_months, next_review_at)
    values (tg_table_name, new.id, v_type.interval_months,
            (current_date + make_interval(months => v_type.interval_months))::date)
    on conflict (entity_table, entity_id) do nothing;
    return null;
  end if;
  v_old := to_jsonb(old) - array['updated_at','updated_by','valid_to'];
  v_new := to_jsonb(new) - array['updated_at','updated_by','valid_to'];
  if v_old = v_new then
    return null;
  end if;
  insert into public.data_reviews (entity_table, entity_id, interval_months, last_reviewed_at, last_reviewed_by, next_review_at)
  values (tg_table_name, new.id, v_type.interval_months, now(), auth.uid(),
          (current_date + make_interval(months => v_type.interval_months))::date)
  on conflict (entity_table, entity_id) do update
    set last_reviewed_at = excluded.last_reviewed_at,
        last_reviewed_by = excluded.last_reviewed_by,
        next_review_at = (current_date + make_interval(months => public.data_reviews.interval_months))::date;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['recurring_overheads','labor_rates','resources','income_tax_brackets','work_patterns','companies']
  loop
    execute format('create trigger track_data_review after insert or update or delete on public.%I
                    for each row execute function private.track_data_review()', t);
    -- existing rows: due one interval after they were created
    execute format($q$insert into public.data_reviews (entity_table, entity_id, interval_months, next_review_at)
                      select %L, id, 12, (created_at::date + interval '12 months')::date from public.%I
                      on conflict do nothing$q$, t, t);
  end loop;
end;
$$;

-- "Potvrdiť bez zmeny": who and when, next date moves by the interval (logged by log_change)
create function public.confirm_data_review(p_entity_table text, p_entity_id uuid) returns date
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_next date;
begin
  update public.data_reviews
     set last_reviewed_at = now(),
         last_reviewed_by = auth.uid(),
         next_review_at = (current_date + make_interval(months => interval_months))::date
   where entity_table = p_entity_table and entity_id = p_entity_id
  returning next_review_at into v_next;
  if v_next is null then
    raise exception 'data_reviews: no review for %/%', p_entity_table, p_entity_id using errcode = 'P0002';
  end if;
  return v_next;
end;
$$;
revoke all on function public.confirm_data_review(text, uuid) from public, anon;
grant execute on function public.confirm_data_review(text, uuid) to authenticated;

-- currently valid records with their review state (computed on read, no cron job)
create view public.v_reviews_due with (security_invoker = true) as
with current_records as (
  select 'recurring_overheads'::text as entity_table, r.id as entity_id,
         r.category || coalesce(' · ' || d.name, '') as record_name
    from public.recurring_overheads r left join public.divisions d on d.id = r.division_id
   where r.valid_to is null or r.valid_to >= current_date
  union all
  select 'labor_rates', lr.id, ro.name || ' · od ' || to_char(lr.valid_from, 'DD/MM/YYYY')
    from public.labor_rates lr join public.labor_roles ro on ro.id = lr.role_id
   where lr.valid_to is null or lr.valid_to >= current_date
  union all
  select 'resources', e.id, e.name from public.resources e where e.is_active
  union all
  select 'income_tax_brackets', b.id, 'Pásmo od ' || to_char(b.valid_from, 'DD/MM/YYYY') || ' · ' || b.rate_pct::text || ' %'
    from public.income_tax_brackets b
   where b.valid_to is null or b.valid_to >= current_date
  union all
  select 'work_patterns', w.id, coalesce(nullif(p.full_name, ''), p.email, 'Zdroj') || ' · od ' || to_char(w.valid_from, 'DD/MM/YYYY')
    from public.work_patterns w
    join public.bookable_resources br on br.id = w.resource_id
    left join public.profiles p on p.id = br.profile_id
   where w.valid_to is null or w.valid_to >= current_date
  union all
  select 'companies', c.id, c.legal_name from public.companies c
)
select cr.entity_table, cr.entity_id, t.label, cr.record_name,
       dr.next_review_at, dr.last_reviewed_at, dr.last_reviewed_by,
       case when dr.next_review_at < current_date then 'overdue'
            when dr.next_review_at <= current_date + 30 then 'due_soon'
            else 'ok' end as state
from current_records cr
join public.data_reviews dr on dr.entity_table = cr.entity_table and dr.entity_id = cr.entity_id
join public.data_review_types t on t.entity_table = cr.entity_table and t.is_active;

-- ---------------------------------------------------------------------
-- 3. Notification event types: only known ones (sending in phase 8)
-- ---------------------------------------------------------------------
alter table public.notification_recipients
  add constraint notification_recipients_known_events
  check (event_types <@ array['data_review_due']::text[]);

-- ---------------------------------------------------------------------
-- 4. Standard setup (no delete: versions and reviews keep their history)
-- ---------------------------------------------------------------------
select private.setup_admin_table(t)
from unnest(array['recurring_overheads','data_review_types','data_reviews']) as t;

revoke all on public.v_overhead_monthly, public.v_reviews_due from anon;
grant select on public.v_overhead_monthly, public.v_reviews_due to authenticated;
