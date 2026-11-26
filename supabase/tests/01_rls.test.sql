-- RLS: anon / aal1 / aal2 non-admin / aal2 admin on every phase-1 table.
select * from no_plan();

-- fixtures (as table owner, RLS bypassed) -------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

insert into public.companies (legal_name) values ('Test s.r.o.') on conflict do nothing;
insert into public.divisions (code, name) values ('AVENG', 'AVENG') on conflict (code) do nothing;
insert into public.feature_flags (key) values ('test_flag') on conflict do nothing;
insert into public.system_settings (key, value) values ('test_setting', '1') on conflict do nothing;
insert into public.number_series (doc_type, year, prefix) values ('DOP', 2998, 'DOP') on conflict do nothing;
insert into public.status_transitions (entity_table, from_status, to_status, label_sk)
  values ('zz_rls_probe', 'a', 'b', 'Test') on conflict do nothing;
insert into public.activity_logs (table_name, action) values ('rls_probe', 'insert');
insert into public.notification_recipients (email) values ('rls-probe@test.invalid');
insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('companies', gen_random_uuid(), 'logo',
          '2026/companies/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002-probe.png',
          'probe.png', 'image/png', 1);

-- meta: no table without RLS and without the restrictive aal2 policy ----------------------
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity $$,
  'every public table has RLS enabled');

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p')
        and not exists (select 1 from pg_policies p
                         where p.schemaname = 'public' and p.tablename = c.relname
                           and p.policyname = 'require_aal2' and p.permissive = 'RESTRICTIVE') $$,
  'every public table has the restrictive require_aal2 policy');

-- anon: no access at all -----------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['companies','divisions','profiles','user_roles','feature_flags','system_settings',
                  'number_series','status_transitions','activity_logs',
                  'notification_recipients','documents']) as t;
reset role;

-- authenticated with aal1 (even an admin): sees nothing -----------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['companies','divisions','profiles','user_roles','feature_flags','system_settings',
                  'number_series','status_transitions','activity_logs',
                  'notification_recipients','documents']) as t;
select throws_ok($$insert into public.system_settings (key, value) values ('x', '1')$$,
  '42501', null, 'admin with aal1 cannot write');
reset role;

-- aal2 admin: reads everything, writes where allowed ----------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select isnt_empty(format('select 1 from public.%I', t), t || ': admin with aal2 can read')
from unnest(array['companies','divisions','profiles','user_roles','feature_flags','system_settings',
                  'number_series','status_transitions','activity_logs',
                  'notification_recipients','documents']) as t;
select lives_ok($$insert into public.system_settings (key, value) values ('inactivity_minutes', '30')$$,
  'admin can insert a setting');
select lives_ok($$update public.system_settings set value = '45' where key = 'inactivity_minutes'$$,
  'admin can update a setting');
select lives_ok($$update public.feature_flags set enabled = true where key = 'test_flag'$$,
  'admin can toggle a feature flag');
select throws_ok($$update public.activity_logs set note = 'tamper'$$, '42501', null,
  'admin cannot update activity_logs');
select throws_ok($$delete from public.activity_logs$$, '42501', null,
  'admin cannot delete activity_logs');
select throws_ok($$insert into public.activity_logs (table_name, action) values ('x', 'insert')$$,
  '42501', null, 'admin cannot insert into activity_logs directly');
select throws_ok($$insert into public.number_series (doc_type, year, prefix) values ('CP', 2997, 'CP')$$,
  '42501', null, 'admin cannot write number_series directly');
select throws_ok($$update public.status_transitions set label_sk = 'x'$$, '42501', null,
  'admin cannot change status_transitions through the API');
select lives_ok($$insert into public.user_roles (user_id, role)
                  values ('b0000000-0000-0000-0000-00000000000b', 'manager')$$,
  'admin can assign a role');
reset role;

-- aal2 user without any role -----------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['companies','system_settings','number_series','activity_logs',
                  'notification_recipients','documents']) as t;
select isnt_empty(format('select 1 from public.%I', t), t || ': readable by every aal2 user')
from unnest(array['divisions','feature_flags','status_transitions']) as t;
select is((select count(*) from public.profiles), 1::bigint, 'user sees only their own profile');
select is((select count(*) from public.user_roles), 1::bigint, 'user sees only their own roles');
select throws_ok($$insert into public.system_settings (key, value) values ('y', '1')$$,
  '42501', null, 'user without role cannot write settings');
update public.companies set legal_name = 'Hacked';
select throws_ok($$insert into public.user_roles (user_id, role)
                  values ('b0000000-0000-0000-0000-00000000000b', 'admin')$$,
  '42501', null, 'user cannot grant themselves admin');
reset role;
select is_empty($$select 1 from public.companies where legal_name = 'Hacked'$$,
  'update by a user without role changed 0 company rows');

-- v_open_items: zeros for aal2, nothing for aal1, anon denied -------------------------------
set local role anon;
select throws_ok('select 1 from public.v_open_items', '42501', null, 'v_open_items: anon is denied');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty('select 1 from public.v_open_items', 'v_open_items: aal1 sees nothing');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select new_inquiries + quotes_to_approve + visuals_waiting + overdue_tasks
                  + delivered_not_invoiced + invoices_overdue from public.v_open_items),
  0, 'v_open_items: aal2 gets one row of zeros');
reset role;

select * from finish();
