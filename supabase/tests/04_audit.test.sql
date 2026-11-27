-- Audit columns (set_updated) and change log (log_change); activity_logs is append-only.
select * from no_plan();

insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
insert into public.system_settings (key, value) values ('audit_probe', '1');
select is((select created_by from public.system_settings where key = 'audit_probe'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'created_by is filled from the session');
update public.system_settings set value = '2', created_by = null where key = 'audit_probe';
select is((select created_by from public.system_settings where key = 'audit_probe'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'created_by cannot be changed afterwards');
select is((select updated_by from public.system_settings where key = 'audit_probe'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'updated_by is filled on update');
update public.system_settings set value = '2' where key = 'audit_probe';   -- no real change
reset role;

select is((select count(*) from public.activity_logs
            where table_name = 'system_settings' and new_data ->> 'key' = 'audit_probe' and action = 'insert'),
  1::bigint, 'insert is logged');
select is((select count(*) from public.activity_logs
            where table_name = 'system_settings' and new_data ->> 'key' = 'audit_probe' and action = 'update'),
  1::bigint, 'real update is logged once, the no-op update is not');
select is((select old_data ->> 'value' from public.activity_logs
            where table_name = 'system_settings' and new_data ->> 'key' = 'audit_probe' and action = 'update'),
  '1', 'old and new values are stored');
select is((select actor from public.activity_logs
            where table_name = 'system_settings' and action = 'insert' and new_data ->> 'key' = 'audit_probe'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'actor is stored');

delete from public.system_settings where key = 'audit_probe';
select is((select count(*) from public.activity_logs
            where table_name = 'system_settings' and old_data ->> 'key' = 'audit_probe' and action = 'delete'),
  1::bigint, 'delete is logged');

-- the profile of a new auth user is created automatically
select is((select email from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'),
  'admin@test.local', 'profile is created for a new auth user');

-- append-only: not even the table owner can change or remove log rows
select throws_ok($$update public.activity_logs set note = 'tamper'$$, '42501', null,
  'owner cannot update activity_logs');
select throws_ok($$delete from public.activity_logs$$, '42501', null, 'owner cannot delete from activity_logs');
select throws_ok($$truncate public.activity_logs$$, '42501', null, 'owner cannot truncate activity_logs');

-- phase 2 tables are audited as well
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
insert into public.notification_recipients (email, event_types) values ('audit-probe@test.invalid', '{data_review_due}');
update public.notification_recipients set is_active = false where email = 'audit-probe@test.invalid';
reset role;
select is((select count(*) from public.activity_logs where table_name = 'notification_recipients'
            and coalesce(new_data, old_data) ->> 'email' = 'audit-probe@test.invalid'), 2::bigint,
  'notification_recipients insert and update are logged');
select is((select count(*) from pg_trigger where tgname = 'log_change'
            and tgrelid in ('public.documents'::regclass, 'public.notification_recipients'::regclass)), 2::bigint,
  'documents and notification_recipients have the log_change trigger');

select * from finish();
