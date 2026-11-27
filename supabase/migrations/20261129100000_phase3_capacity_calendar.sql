-- =====================================================================
-- Phase 3 / block H – capacity from calendars (D24, moved from F5a to F3).
-- Resources (kinds as configuration), weekly work patterns, calendar
-- exceptions, Slovak public holidays (days of rest), computed capacity.
-- Replaces the hand-entered capacity_plans (owner agreed to drop it,
-- including its single test row on dev).
-- Source: docs/analyzy/ANALYZA-RIADENIE-PROJEKTOV-A-ZDROJOV.md, DATABASE_SCHEMA §19.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. resource_kinds – configuration; only "user" is active now
-- ---------------------------------------------------------------------
create table public.resource_kinds (
  code         text primary key check (code ~ '^[a-z_]{2,30}$'),
  name         text not null check (length(btrim(name)) between 1 and 100),
  has_capacity boolean not null,
  cost_source  text not null check (cost_source in ('labor_rate','purchase_order','equipment_rate','none')),
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

insert into public.resource_kinds (code, name, has_capacity, cost_source, is_active) values
  ('user',            'Človek (konateľ)',                  true,  'labor_rate',     true),
  ('supplier',        'Dodávateľ',                         false, 'purchase_order', false),
  ('equipment',       'Technika a vybavenie',              true,  'equipment_rate', false),
  ('external_person', 'Externá osoba',                     true,  'labor_rate',     false),
  ('ai_agent',        'AI agent / automatizovaná služba',  true,  'none',           false);

-- ---------------------------------------------------------------------
-- 2. bookable_resources – the calendar belongs to a resource (F5a reuses it)
-- ---------------------------------------------------------------------
create table public.bookable_resources (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null references public.resource_kinds (code),
  profile_id   uuid unique references public.profiles (id) on delete cascade,
  supplier_id  uuid unique references public.suppliers (id),
  equipment_id uuid unique references public.resources (id),
  name         text check (length(btrim(name)) between 1 and 200),
  division_id  uuid references public.divisions (id),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  -- exactly the one link that belongs to the kind; kinds without a link carry a name
  check (
    (kind = 'user'      and num_nonnulls(profile_id, supplier_id, equipment_id) = 1 and profile_id is not null) or
    (kind = 'supplier'  and num_nonnulls(profile_id, supplier_id, equipment_id) = 1 and supplier_id is not null) or
    (kind = 'equipment' and num_nonnulls(profile_id, supplier_id, equipment_id) = 1 and equipment_id is not null) or
    (kind in ('external_person','ai_agent') and num_nonnulls(profile_id, supplier_id, equipment_id) = 0 and name is not null)
  )
);

-- only active kinds can be used (the others are prepared for later phases)
create function private.check_resource_kind_active() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.resource_kinds where code = new.kind and is_active) then
    raise exception 'bookable_resources: resource kind % is not active', new.kind
      using errcode = '23514', hint = 'inactive_kind';
  end if;
  return new;
end;
$$;
create trigger check_resource_kind_active before insert or update of kind on public.bookable_resources
  for each row execute function private.check_resource_kind_active();

-- every profile is a resource of kind "user" (security definer: runs for any new user)
create function private.create_user_resource() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.bookable_resources (kind, profile_id) values ('user', new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;
create trigger create_user_resource after insert on public.profiles
  for each row execute function private.create_user_resource();

insert into public.bookable_resources (kind, profile_id)
select 'user', id from public.profiles
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------------
-- 3. work_patterns – weekly pattern Mon–Sun in hours, validity without overlap
-- ---------------------------------------------------------------------
create table public.work_patterns (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.bookable_resources (id) on delete cascade,
  valid_from  date not null,
  valid_to    date,
  mon numeric(4,2) not null default 0 check (mon between 0 and 24),
  tue numeric(4,2) not null default 0 check (tue between 0 and 24),
  wed numeric(4,2) not null default 0 check (wed between 0 and 24),
  thu numeric(4,2) not null default 0 check (thu between 0 and 24),
  fri numeric(4,2) not null default 0 check (fri between 0 and 24),
  sat numeric(4,2) not null default 0 check (sat between 0 and 24),
  sun numeric(4,2) not null default 0 check (sun between 0 and 24),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  check (valid_to is null or valid_to >= valid_from),
  constraint work_patterns_no_overlap exclude using gist (
    resource_id with =,
    daterange(valid_from, valid_to, '[]') with &&
  )
);

-- a change = new version from a date; the previous one is closed the day before
create function public.revise_work_pattern(
  p_resource_id uuid, p_valid_from date,
  p_mon numeric, p_tue numeric, p_wed numeric, p_thu numeric,
  p_fri numeric, p_sat numeric, p_sun numeric
) returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- the same start date = correction of that version
  update public.work_patterns
     set mon = p_mon, tue = p_tue, wed = p_wed, thu = p_thu, fri = p_fri, sat = p_sat, sun = p_sun
   where resource_id = p_resource_id and valid_from = p_valid_from
  returning id into v_id;
  if v_id is not null then
    return v_id;
  end if;
  -- close the version valid on that day (later versions stay as they are)
  update public.work_patterns
     set valid_to = p_valid_from - 1
   where resource_id = p_resource_id
     and valid_from < p_valid_from
     and (valid_to is null or valid_to >= p_valid_from);
  insert into public.work_patterns (resource_id, valid_from, valid_to, mon, tue, wed, thu, fri, sat, sun)
  values (
    p_resource_id, p_valid_from,
    (select min(valid_from) - 1 from public.work_patterns
      where resource_id = p_resource_id and valid_from > p_valid_from),
    p_mon, p_tue, p_wed, p_thu, p_fri, p_sat, p_sun)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.revise_work_pattern(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.revise_work_pattern(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4. calendar_exceptions – day or period; general reasons only (no health data)
-- ---------------------------------------------------------------------
create table public.calendar_exceptions (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.bookable_resources (id) on delete cascade,
  date_from   date not null,
  date_to     date not null,
  kind        text not null check (kind in ('vacation','unavailable','other_work','extra')),
  hours       numeric(4,2),
  note        text check (length(note) <= 200),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  check (date_to >= date_from),
  check (date_to - date_from <= 366),
  -- vacation / unavailable = the whole day 0 h (owner's decision); other work subtracts,
  -- extra adds the given hours per day
  check (
    (kind in ('vacation','unavailable') and hours is null) or
    (kind in ('other_work','extra') and hours is not null and hours > 0 and hours <= 24)
  )
);
create index calendar_exceptions_resource_idx on public.calendar_exceptions (resource_id, date_from);

-- ---------------------------------------------------------------------
-- 5. public_holidays – reference data, Act No. 241/1993 Coll. as amended
--    (from 1 November 2025). Only days of rest reduce the capacity.
-- ---------------------------------------------------------------------
create table public.public_holidays (
  date       date primary key,
  name       text not null check (length(btrim(name)) between 1 and 120),
  is_day_off boolean not null,
  source     text not null check (length(source) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Easter Sunday (Gregorian calendar, anonymous algorithm – Meeus/Jones/Butcher)
create function private.sk_easter_sunday(p_year int) returns date
language plpgsql immutable
set search_path = ''
as $$
declare
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  mon int := (h + l - 7 * m + 114) / 31;
  day int := ((h + l - 7 * m + 114) % 31) + 1;
begin
  return make_date(p_year, mon, day);
end;
$$;

-- Fills one year (2025 and later) by the rules valid since 1 November 2025. Existing rows
-- are kept (manual corrections win). Rules and their sources: phase-3 report, block H.
create function public.fill_sk_holidays(p_year int) returns int
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_src  text := 'Zákon č. 241/1993 Z. z. v znení účinnom od 1. 11. 2025 (NIP: ip.gov.sk); '
                 || 'rok 2026: 8. 5. a 15. 9. nie sú dňom pracovného pokoja (NIP). Overiť na Slov-Lexe.';
  v_easter date := private.sk_easter_sunday(p_year);
  v_count int;
begin
  if p_year < 2025 or p_year > 2100 then
    raise exception 'fill_sk_holidays: year % is outside 2025–2100', p_year using errcode = '22023';
  end if;
  insert into public.public_holidays (date, name, is_day_off, source)
  select d, n, off, v_src
  from (values
    (make_date(p_year, 1, 1),   'Deň vzniku Slovenskej republiky',                   true),
    (make_date(p_year, 1, 6),   'Zjavenie Pána (Traja králi)',                       true),
    (v_easter - 2,              'Veľký piatok',                                      true),
    (v_easter + 1,              'Veľkonočný pondelok',                               true),
    (make_date(p_year, 5, 1),   'Sviatok práce',                                     true),
    (make_date(p_year, 5, 8),   'Deň víťazstva nad fašizmom',                        p_year <> 2026),
    (make_date(p_year, 7, 5),   'Sviatok svätého Cyrila a svätého Metoda',           true),
    (make_date(p_year, 8, 29),  'Výročie Slovenského národného povstania',           true),
    (make_date(p_year, 9, 1),   'Deň Ústavy Slovenskej republiky',                   false),
    (make_date(p_year, 9, 15),  'Sedembolestná Panna Mária',                         p_year <> 2026),
    (make_date(p_year, 11, 1),  'Sviatok Všetkých svätých',                          true),
    (make_date(p_year, 11, 17), 'Deň boja za slobodu a demokraciu',                  false),
    (make_date(p_year, 12, 24), 'Štedrý deň',                                        true),
    (make_date(p_year, 12, 25), 'Prvý sviatok vianočný',                             true),
    (make_date(p_year, 12, 26), 'Druhý sviatok vianočný',                            true)
  ) as h(d, n, off)
  on conflict (date) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.fill_sk_holidays(int) from public, anon;
grant execute on function public.fill_sk_holidays(int) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Capacity: pattern − day of rest ± exceptions, never below 0
-- ---------------------------------------------------------------------
create function public.resource_capacity(p_resource_id uuid, p_from date, p_to date)
returns table (
  resource_id     uuid,
  day             date,
  pattern_hours   numeric,
  holiday_name    text,
  is_day_off      boolean,
  is_absent       boolean,
  other_work      numeric,
  extra           numeric,
  available_hours numeric
)
language sql stable security invoker
set search_path = ''
as $$
  with days as (
    select d::date as day
    from generate_series(p_from, least(p_to, p_from + 400), interval '1 day') as d
  ),
  base as (
    select
      r.id as resource_id,
      days.day,
      coalesce((
        select case extract(isodow from days.day)::int
                 when 1 then wp.mon when 2 then wp.tue when 3 then wp.wed when 4 then wp.thu
                 when 5 then wp.fri when 6 then wp.sat else wp.sun end
          from public.work_patterns wp
         where wp.resource_id = r.id
           and days.day between wp.valid_from and coalesce(wp.valid_to, 'infinity'::date)
      ), 0) as pattern_hours,
      ph.name as holiday_name,
      coalesce(ph.is_day_off, false) as is_day_off,
      exists (
        select 1 from public.calendar_exceptions ce
         where ce.resource_id = r.id and ce.kind in ('vacation','unavailable')
           and days.day between ce.date_from and ce.date_to
      ) as is_absent,
      coalesce((select sum(ce.hours) from public.calendar_exceptions ce
                 where ce.resource_id = r.id and ce.kind = 'other_work'
                   and days.day between ce.date_from and ce.date_to), 0) as other_work,
      coalesce((select sum(ce.hours) from public.calendar_exceptions ce
                 where ce.resource_id = r.id and ce.kind = 'extra'
                   and days.day between ce.date_from and ce.date_to), 0) as extra
    from public.bookable_resources r
    cross join days
    left join public.public_holidays ph on ph.date = days.day
    where r.id = p_resource_id
  )
  select resource_id, day, pattern_hours, holiday_name, is_day_off, is_absent, other_work, extra,
         greatest(0, (case when is_day_off or is_absent then 0 else pattern_hours end)
                     - other_work + extra) as available_hours
  from base
  order by day;
$$;
revoke all on function public.resource_capacity(uuid, date, date) from public, anon;
grant execute on function public.resource_capacity(uuid, date, date) to authenticated;

-- names of resources (profile / supplier / equipment / own name)
create view public.v_bookable_resources with (security_invoker = true) as
select r.id, r.kind, r.is_active, r.division_id, r.profile_id, r.supplier_id, r.equipment_id,
       coalesce(nullif(p.full_name, ''), p.email, s.name, e.name, r.name) as display_name
from public.bookable_resources r
left join public.profiles  p on p.id = r.profile_id
left join public.suppliers s on s.id = r.supplier_id
left join public.resources e on e.id = r.equipment_id;

-- daily capacity of all resources for the previous and the next 12 months (reporting)
create view public.v_resource_capacity_daily with (security_invoker = true) as
select c.*
from public.bookable_resources r
cross join lateral public.resource_capacity(
  r.id,
  (date_trunc('month', current_date) - interval '12 months')::date,
  (date_trunc('month', current_date) + interval '13 months' - interval '1 day')::date
) c;

create view public.v_resource_capacity_weekly with (security_invoker = true) as
select resource_id, date_trunc('week', day)::date as week_start,
       sum(available_hours) as available_hours, sum(pattern_hours) as pattern_hours
from public.v_resource_capacity_daily
group by resource_id, date_trunc('week', day);

create view public.v_resource_capacity_monthly with (security_invoker = true) as
select resource_id, date_trunc('month', day)::date as month,
       sum(available_hours) as available_hours, sum(pattern_hours) as pattern_hours
from public.v_resource_capacity_daily
group by resource_id, date_trunc('month', day);

-- ---------------------------------------------------------------------
-- 7. Standard setup; capacity_plans replaced by the calculation
-- ---------------------------------------------------------------------
select private.setup_admin_table(t)
from unnest(array['resource_kinds','bookable_resources']) as t;
select private.setup_admin_table(t, true)
from unnest(array['work_patterns','calendar_exceptions','public_holidays']) as t;

revoke all on public.v_bookable_resources, public.v_resource_capacity_daily,
              public.v_resource_capacity_weekly, public.v_resource_capacity_monthly from anon;
grant select on public.v_bookable_resources, public.v_resource_capacity_daily,
                public.v_resource_capacity_weekly, public.v_resource_capacity_monthly to authenticated;

select public.fill_sk_holidays(y) from generate_series(2025, 2030) as y;

drop table public.capacity_plans;
