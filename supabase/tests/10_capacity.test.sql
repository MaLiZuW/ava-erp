-- Block H: resources, work patterns, calendar exceptions, Slovak holidays, computed capacity.
select * from no_plan();

-- a new auth user gets a profile (phase 1 trigger) and a resource of kind "user" (this block)
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

select is((select kind from public.bookable_resources where profile_id = 'a0000000-0000-0000-0000-00000000000a'),
  'user', 'a new profile automatically gets a resource of kind user');
select is((select count(*) from public.resource_kinds where is_active), 1::bigint, 'only one kind is active');
select is((select code from public.resource_kinds where is_active), 'user', 'the active kind is user');
select is((select count(*) from public.resource_kinds where code in ('supplier','equipment','external_person','ai_agent') and not is_active),
  4::bigint, 'supplier, equipment, external person and AI agent are prepared, inactive');
select hasnt_table('public', 'capacity_plans', 'capacity_plans is replaced by the calculation');

-- holidays: Easter by calculation; 2026 without 8 May and 15 September as days of rest
select is(private.sk_easter_sunday(2025), '2025-04-20'::date, 'Easter Sunday 2025');
select is(private.sk_easter_sunday(2026), '2026-04-05'::date, 'Easter Sunday 2026');
select is(private.sk_easter_sunday(2027), '2027-03-28'::date, 'Easter Sunday 2027');
select is((select is_day_off from public.public_holidays where date = '2026-04-03'), true, 'Good Friday 2026 is a day of rest');
select is((select is_day_off from public.public_holidays where date = '2026-04-06'), true, 'Easter Monday 2026 is a day of rest');
select is((select is_day_off from public.public_holidays where date = '2026-05-08'), false, '8 May 2026 is not a day of rest');
select is((select is_day_off from public.public_holidays where date = '2026-09-15'), false, '15 September 2026 is not a day of rest');
select is((select is_day_off from public.public_holidays where date = '2027-05-08'), true, '8 May 2027 is a day of rest again');
select is((select is_day_off from public.public_holidays where date = '2025-09-01'), false, '1 September is a holiday, not a day of rest');
select is((select is_day_off from public.public_holidays where date = '2025-11-17'), false, '17 November is a holiday, not a day of rest');
select is((select count(*) from public.public_holidays where extract(year from date) = 2027 and is_day_off), 13::bigint,
  '2027: 13 days of rest');
select is((select count(*) from public.public_holidays where extract(year from date) = 2026 and is_day_off), 11::bigint,
  '2026: 11 days of rest');
select throws_ok('select public.fill_sk_holidays(2024)', '22023', null, 'years before 2025 are refused (other rules)');

-- anon / aal1 / no role ------------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['resource_kinds','bookable_resources','work_patterns','calendar_exceptions','public_holidays',
                  'v_bookable_resources','v_resource_capacity_daily']) as t;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['resource_kinds','bookable_resources','work_patterns','calendar_exceptions','public_holidays',
                  'v_bookable_resources','v_resource_capacity_monthly']) as t;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['bookable_resources','work_patterns','calendar_exceptions','public_holidays']) as t;
reset role;

-- aal2 admin ------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

create temp table r on commit drop as
  select id from public.bookable_resources where profile_id = 'a0000000-0000-0000-0000-00000000000a';

select throws_ok($$insert into public.bookable_resources (kind, name) values ('ai_agent', 'Robot')$$,
  '23514', null, 'an inactive kind cannot be used yet');
select throws_ok($$insert into public.bookable_resources (kind, name) values ('user', 'Bez profilu')$$,
  '23514', null, 'a user resource must link a profile');

-- weekly pattern 8 h Mon–Fri from 2026-06-01 (Monday)
select lives_ok($$select public.revise_work_pattern((select id from r), '2026-06-01', 8, 8, 8, 8, 8, 0, 0)$$,
  'admin saves a weekly pattern');
select throws_ok($$insert into public.work_patterns (resource_id, valid_from, mon) values ((select id from r), '2026-07-01', 4)$$,
  '23P01', null, 'overlapping pattern periods are refused');
select throws_ok($$insert into public.work_patterns (resource_id, valid_from, valid_to, mon) values ((select id from r), '2025-02-01', '2025-01-01', 1)$$,
  '23514', null, 'valid_to before valid_from is refused');
select throws_ok($$insert into public.work_patterns (resource_id, valid_from, mon) values ((select id from r), '2020-01-01', 25)$$,
  '23514', null, 'more than 24 h a day is refused');

-- new version from 2026-08-03: the previous one is closed the day before
select lives_ok($$select public.revise_work_pattern((select id from r), '2026-08-03', 6, 6, 6, 6, 6, 0, 0)$$,
  'a new version from a later date');
select is((select valid_to from public.work_patterns where resource_id = (select id from r) and valid_from = '2026-06-01'),
  '2026-08-02'::date, 'the previous version is closed the day before');

-- exceptions
select throws_ok($$insert into public.calendar_exceptions (resource_id, date_from, date_to, kind, hours)
                   values ((select id from r), '2026-06-10', '2026-06-10', 'vacation', 3)$$,
  '23514', null, 'vacation has no hours (whole day 0 h)');
select throws_ok($$insert into public.calendar_exceptions (resource_id, date_from, date_to, kind)
                   values ((select id from r), '2026-06-10', '2026-06-10', 'extra')$$,
  '23514', null, 'extra hours must be given');
select throws_ok($$insert into public.calendar_exceptions (resource_id, date_from, date_to, kind)
                   values ((select id from r), '2026-06-12', '2026-06-11', 'vacation')$$,
  '23514', null, 'period end before start is refused');
insert into public.calendar_exceptions (resource_id, date_from, date_to, kind) values
  ((select id from r), '2026-06-15', '2026-06-16', 'vacation');
insert into public.calendar_exceptions (resource_id, date_from, date_to, kind, hours) values
  ((select id from r), '2026-06-17', '2026-06-17', 'other_work', 3),
  ((select id from r), '2026-06-18', '2026-06-18', 'other_work', 10),
  ((select id from r), '2026-06-20', '2026-06-20', 'extra', 4),            -- Saturday
  ((select id from r), '2026-07-06', '2026-07-06', 'extra', 2);            -- Monday after 5 July (not a holiday)
insert into public.calendar_exceptions (resource_id, date_from, date_to, kind, hours) values
  ((select id from r), '2026-08-29', '2026-08-29', 'extra', 5);            -- SNP anniversary (Saturday, day of rest)

-- daily capacity
create temp table cap on commit drop as
  select * from public.resource_capacity((select id from r), '2026-06-01', '2026-08-31');
select is((select available_hours from cap where day = '2026-06-01'), 8.00, 'pattern: Monday 8 h');
select is((select available_hours from cap where day = '2026-06-06'), 0.00, 'pattern: Saturday 0 h');
select is((select available_hours from cap where day = '2026-06-15'), 0.00, 'vacation: 0 h');
select is((select available_hours from cap where day = '2026-06-17'), 5.00, 'other work subtracts 3 h');
select is((select available_hours from cap where day = '2026-06-18'), 0.00, 'never below 0');
select is((select available_hours from cap where day = '2026-06-20'), 4.00, 'extra hours add on a Saturday');
select is((select available_hours from cap where day = '2026-07-06'), 10.00, 'extra hours add on a work day');
select is((select available_hours from cap where day = '2026-08-04'), 6.00, 'the new version applies from its date');
select is((select available_hours from cap where day = '2026-08-29'), 5.00, 'extra hours count on a day of rest');
select is((select is_day_off from cap where day = '2026-08-29'), true, '29 August is a day of rest');
select is((select available_hours from cap where day = '2026-09-01'), null, 'outside the requested range');

-- June 2026: 22 work days × 8 h = 176; − 2 vacation days (16) − 3 − 8 + 4 = 153
select is((select sum(available_hours) from cap where day between '2026-06-01' and '2026-06-30'), 153.00,
  'June 2026 total');
select is((select available_hours from public.v_resource_capacity_monthly
            where resource_id = (select id from r) and month = '2026-06-01'), 153.00,
  'monthly view gives the same June total');
select is((select available_hours from public.v_resource_capacity_weekly
            where resource_id = (select id from r) and week_start = '2026-06-15'), 17.00,
  'week of 15 June: 0 + 0 + 5 + 0 + 8 + 4 + 0 = 17 h');

select lives_ok($$delete from public.calendar_exceptions where kind = 'other_work' and resource_id = (select id from r)$$,
  'admin can delete an exception');
select isnt_empty('select 1 from public.v_bookable_resources where display_name = ''admin@test.local''',
  'the resource view shows the person name / e-mail');
reset role;

-- audit
select isnt_empty($$select 1 from public.activity_logs where table_name = 'work_patterns' and action = 'update'$$,
  'closing a pattern version is logged');
select isnt_empty($$select 1 from public.activity_logs where table_name = 'calendar_exceptions' and action = 'delete'$$,
  'deleted exception is logged');

-- deleting a user removes the resource and its calendar (test users can be cleaned up)
delete from public.calendar_exceptions where resource_id = (select id from public.bookable_resources where profile_id = 'b0000000-0000-0000-0000-00000000000b');
delete from auth.users where id = 'b0000000-0000-0000-0000-00000000000b';
select is_empty($$select 1 from public.bookable_resources where profile_id = 'b0000000-0000-0000-0000-00000000000b'$$,
  'the resource of a deleted user is removed');

select * from finish();
