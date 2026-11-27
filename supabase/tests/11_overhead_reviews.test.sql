-- Block I: recurring overhead (versions, monthly shares) and periodic data review.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');
insert into public.divisions (code, name) values ('AVENG', 'AVENG'), ('AGENCY', 'Agentúra') on conflict (code) do nothing;

-- anon / aal1 / no role -----------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['recurring_overheads','data_review_types','data_reviews','v_overhead_monthly','v_reviews_due']) as t;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['recurring_overheads','data_review_types','data_reviews','v_reviews_due']) as t;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['recurring_overheads','data_review_types','data_reviews']) as t;
reset role;

-- monthly share: exact cents over a whole period
select is((select sum(private.overhead_month_share(100000, 'yearly', '2026-01-01', (date '2026-01-01' + make_interval(months => m))::date))
             from generate_series(0, 11) as m), 100000::numeric, 'yearly 1 000,00 € over 12 months = exactly 1 000,00 €');
select is(private.overhead_month_share(100000, 'yearly', '2026-01-01', '2026-01-01'), 8334::bigint, 'yearly: first months take the remaining cents');
select is(private.overhead_month_share(100000, 'yearly', '2026-01-01', '2026-12-01'), 8333::bigint, 'yearly: 83,33 € later in the year');
select is((select sum(private.overhead_month_share(1000, 'quarterly', '2026-04-01', (date '2026-04-01' + make_interval(months => m))::date))
             from generate_series(0, 2) as m), 1000::numeric, 'quarterly 10,00 € over 3 months = exactly 10,00 €');
select is(private.overhead_month_share(45000, 'monthly', '2026-01-01', '2026-05-01'), 45000::bigint, 'monthly = the amount');

-- admin aal2 ------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

insert into public.recurring_overheads (id, category, amount_cents, frequency, valid_from)
values ('c1000000-0000-0000-0000-000000000001', 'Probe nájom', 45000, 'monthly', '2024-01-01'),
       ('c1000000-0000-0000-0000-000000000002', 'Probe poistenie', 120000, 'yearly', '2024-01-01');

select throws_ok($$insert into public.recurring_overheads (category, amount_cents, frequency, valid_from)
                   values ('probe NÁJOM', 1, 'monthly', '2025-01-01')$$, '23P01', null,
  'the same company-wide cost (division NULL) cannot overlap');
select lives_ok($$insert into public.recurring_overheads (category, division_id, amount_cents, frequency, valid_from)
                  select 'Probe nájom', id, 1000, 'monthly', '2025-01-01' from public.divisions where code = 'AVENG'$$,
  'the same category for a division is another cost');
select throws_ok($$insert into public.recurring_overheads (category, amount_cents, frequency, valid_from)
                   values ('X', 1, 'monthly', '2025-01-15')$$, '23514', null, 'valid_from must be the first day');
select throws_ok($$insert into public.recurring_overheads (category, amount_cents, frequency, valid_from, valid_to)
                   values ('X', 1, 'monthly', '2025-01-01', '2025-03-15')$$, '23514', null, 'valid_to must be the last day of a month');
select throws_ok($$insert into public.recurring_overheads (category, amount_cents, frequency, valid_from)
                   values ('X', -1, 'monthly', '2025-01-01')$$, '23514', null, 'negative amount is refused');
select throws_ok($$insert into public.recurring_overheads (category, amount_cents, frequency, valid_from)
                   values ('X', 1, 'weekly', '2025-01-01')$$, '23514', null, 'unknown frequency is refused');

-- past months are never rewritten: a direct change of the amount is refused, a revision works
select throws_ok($$update public.recurring_overheads set amount_cents = 50000 where id = 'c1000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'the amount of a version used in past months cannot be changed');
select lives_ok($$update public.recurring_overheads set note = 'zmluva 2024' where id = 'c1000000-0000-0000-0000-000000000001'$$,
  'the note can be changed');
select lives_ok($$select public.revise_recurring_overhead('c1000000-0000-0000-0000-000000000001', 50000, '2025-07-01')$$,
  'revision: new amount from July 2025');
select is((select valid_to from public.recurring_overheads where id = 'c1000000-0000-0000-0000-000000000001'),
  '2025-06-30'::date, 'the old version ends the day before');
select throws_ok($$select public.revise_recurring_overhead('c1000000-0000-0000-0000-000000000002', 1, '2025-07-15')$$,
  '23514', null, 'a revision starts on the first day of a month');

-- monthly view: recurring share + one-off items, old months keep the old amount
insert into public.overhead_costs (month, category, amount_cents) values ('2025-07-01', 'Probe oprava', 2000);
select is((select amount_cents from public.v_overhead_monthly
            where month = '2025-06-01' and category = 'Probe nájom' and division_id is null), 45000::bigint,
  'June 2025 keeps the old rent');
select is((select amount_cents from public.v_overhead_monthly
            where month = '2025-07-01' and category = 'Probe nájom' and division_id is null), 50000::bigint,
  'July 2025 has the new rent');
select is((select amount_cents from public.v_overhead_monthly
            where month = '2025-07-01' and category = 'Probe poistenie'), 10000::bigint,
  'yearly insurance 1 200,00 € → 100,00 € a month');
select is((select source from public.v_overhead_monthly where month = '2025-07-01' and category = 'Probe oprava'), 'one_off',
  'one-off items are in the same view');

-- data review: a new record is due after 12 months; confirm moves it; overdue / due soon
select is((select next_review_at from public.data_reviews where entity_table = 'recurring_overheads'
            and entity_id = 'c1000000-0000-0000-0000-000000000002'),
  (current_date + interval '12 months')::date, 'a new record gets a review date 12 months ahead');
select ok(exists(select 1 from public.data_reviews dr join public.recurring_overheads r on r.id = dr.entity_id
                  where r.valid_from = '2025-07-01' and r.category = 'Probe nájom'),
  'the new version from a revision has its own review');
reset role;
update public.data_reviews set next_review_at = current_date - 1
 where entity_id = 'c1000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select state from public.v_reviews_due where entity_id = 'c1000000-0000-0000-0000-000000000002'), 'overdue',
  'past date = overdue');
select is_empty($$select 1 from public.v_reviews_due where entity_id = 'c1000000-0000-0000-0000-000000000001'$$,
  'a closed old version is not listed');
select lives_ok($$select public.confirm_data_review('recurring_overheads', 'c1000000-0000-0000-0000-000000000002')$$,
  'confirm without change');
select is((select state from public.v_reviews_due where entity_id = 'c1000000-0000-0000-0000-000000000002'), 'ok',
  'after confirmation the record is ok');
select is((select last_reviewed_by from public.data_reviews where entity_id = 'c1000000-0000-0000-0000-000000000002'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'who confirmed is stored');
select throws_ok($$select public.confirm_data_review('recurring_overheads', gen_random_uuid())$$, 'P0002', null,
  'confirming an unknown record is refused');
reset role;
update public.data_reviews set next_review_at = current_date + 10
 where entity_id = 'c1000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select state from public.v_reviews_due where entity_id = 'c1000000-0000-0000-0000-000000000002'), 'due_soon',
  'within 30 days = due soon');
-- editing = edit + automatic confirmation
select lives_ok($$update public.recurring_overheads set note = 'nová zmluva' where id = 'c1000000-0000-0000-0000-000000000002'$$,
  'edit a record');
select is((select state from public.v_reviews_due where entity_id = 'c1000000-0000-0000-0000-000000000002'), 'ok',
  'an edit confirms the record');

-- notification event types: only known ones
select lives_ok($$insert into public.notification_recipients (email, event_types) values ('probe@test.invalid', array['data_review_due'])$$,
  'known event type accepted');
select throws_ok($$insert into public.notification_recipients (email, event_types) values ('probe2@test.invalid', array['whatever'])$$,
  '23514', null, 'unknown event type refused');

select throws_ok($$delete from public.recurring_overheads$$, '42501', null, 'recurring overhead is not deleted (versions)');
select throws_ok($$delete from public.data_reviews$$, '42501', null, 'reviews are not deleted by hand');
reset role;

-- audit: the confirmation is in the change history
select isnt_empty($$select 1 from public.activity_logs where table_name = 'data_reviews' and action = 'update'$$,
  'confirmations are logged');
-- existing rows got a review (backfill), e.g. the company
select is((select count(*) from public.data_reviews where entity_table = 'companies'),
  (select count(*) from public.companies), 'every company row has a review');

select * from finish();
