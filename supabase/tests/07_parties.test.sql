-- Phase 3 / block B: customers, suppliers, contacts, machines – RLS, constraints, audit.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

-- fixtures as owner (RLS bypassed)
insert into public.customers (id, name, ico) values
  ('c0000000-0000-0000-0000-000000000001', 'Probe zákazník s.r.o.', '35763469');
insert into public.customer_contacts (customer_id, full_name, email, is_primary) values
  ('c0000000-0000-0000-0000-000000000001', 'Info', 'info@probe.test', true);
insert into public.customer_machines (customer_id, model) values
  ('c0000000-0000-0000-0000-000000000001', 'Probe CNC');
insert into public.suppliers (id, name, country) values
  ('d0000000-0000-0000-0000-000000000001', 'Probe dodávateľ s.r.o.', 'SK'),
  ('d0000000-0000-0000-0000-000000000002', 'Probe GmbH', 'DE');
insert into public.supplier_contacts (supplier_id, full_name) values
  ('d0000000-0000-0000-0000-000000000001', 'Objednávky');

-- anon: denied --------------------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['customers','customer_contacts','customer_machines','suppliers','supplier_contacts']) as t;
reset role;

-- aal1 admin: nothing ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['customers','customer_contacts','customer_machines','suppliers','supplier_contacts']) as t;
select throws_ok($$insert into public.customers (name) values ('aal1')$$, '42501', null,
  'admin with aal1 cannot insert a customer');
reset role;

-- aal2 without role: nothing ------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['customers','customer_contacts','customer_machines','suppliers','supplier_contacts']) as t;
select throws_ok($$insert into public.suppliers (name) values ('x')$$, '42501', null,
  'user without role cannot insert a supplier');
update public.customers set name = 'Hacked';
reset role;
select is_empty($$select 1 from public.customers where name = 'Hacked'$$,
  'update by a user without role changed 0 rows');

-- aal2 admin: read + write, no delete -----------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select isnt_empty(format('select 1 from public.%I', t), t || ': admin with aal2 can read')
from unnest(array['customers','customer_contacts','customer_machines','suppliers','supplier_contacts']) as t;

select lives_ok($$insert into public.customers (id, name, ico, dic, country, payment_terms_days)
                  values ('c0000000-0000-0000-0000-000000000002', 'Druhý s.r.o.', '31333532', '2020123456', 'SK', 14)$$,
  'admin can insert a customer');
select lives_ok($$update public.customers set city = 'Bratislava' where id = 'c0000000-0000-0000-0000-000000000002'$$,
  'admin can update a customer');
select lives_ok($$update public.customers set is_active = false where id = 'c0000000-0000-0000-0000-000000000002'$$,
  'admin can deactivate a customer (soft delete)');
select throws_ok($$delete from public.customers where id = 'c0000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'admin cannot delete a customer (soft delete only)');
select throws_ok($$delete from public.customer_contacts$$, '42501', null, 'admin cannot delete contacts');
select throws_ok($$delete from public.suppliers$$, '42501', null, 'admin cannot delete suppliers');

-- constraints
select throws_ok($$insert into public.customers (name, ico) values ('Duplicita', '35763469')$$,
  '23505', null, 'IČO is unique among customers');
select lives_ok($$insert into public.customers (name) values ('Bez IČO 1'), ('Bez IČO 2')$$,
  'several customers without IČO are allowed');
select throws_ok($$insert into public.customers (name, ico) values ('Zlé IČO', '1234')$$,
  '23514', null, 'IČO must have 8 digits');
select throws_ok($$insert into public.customers (name, country) values ('Krajina', 'sk')$$,
  '23514', null, 'country is a 2-letter upper-case code');
select throws_ok($$insert into public.customers (name, payment_terms_days) values ('Splatnosť', -1)$$,
  '23514', null, 'payment terms cannot be negative');
select throws_ok($$insert into public.customers (name, billing_email) values ('Mail', 'not-an-email')$$,
  '23514', null, 'billing e-mail must look like an e-mail');
select throws_ok($$insert into public.customers (name) values ('   ')$$,
  '23514', null, 'name cannot be blank');
select throws_ok($$insert into public.customer_contacts (customer_id, full_name, is_primary)
                   values ('c0000000-0000-0000-0000-000000000001', 'Druhý primárny', true)$$,
  '23505', null, 'only one primary contact per customer');
select lives_ok($$insert into public.supplier_contacts (supplier_id, full_name, email)
                  values ('d0000000-0000-0000-0000-000000000002', 'Sales', 'sales@probe.test')$$,
  'admin can add a supplier contact');
reset role;

-- is_foreign is computed from the country
select is((select is_foreign from public.suppliers where id = 'd0000000-0000-0000-0000-000000000001'),
  false, 'SK supplier is not foreign');
select is((select is_foreign from public.suppliers where id = 'd0000000-0000-0000-0000-000000000002'),
  true, 'DE supplier is foreign');
select throws_ok($$update public.suppliers set is_foreign = false where id = 'd0000000-0000-0000-0000-000000000002'$$,
  '428C9', null, 'is_foreign cannot be set by hand');

-- audit
select is((select count(*) from public.activity_logs
            where table_name = 'customers' and record_id = 'c0000000-0000-0000-0000-000000000002'),
  3::bigint, 'insert and two updates of a customer are logged');
select is((select created_by from public.customers where id = 'c0000000-0000-0000-0000-000000000002'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'created_by is filled');

-- contacts disappear with their customer (only the owner/service can delete a customer)
delete from public.customer_machines where customer_id = 'c0000000-0000-0000-0000-000000000001';
delete from public.customers where id = 'c0000000-0000-0000-0000-000000000001';
select is_empty($$select 1 from public.customer_contacts
                  where customer_id = 'c0000000-0000-0000-0000-000000000001'$$,
  'contacts are removed together with their customer');

-- the setup helper is not callable through the API
select ok(not has_function_privilege('authenticated', 'private.setup_admin_table(text, boolean)', 'execute'),
  'authenticated cannot execute private.setup_admin_table');

select * from finish();
