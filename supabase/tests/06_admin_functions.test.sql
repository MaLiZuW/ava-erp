-- admin_list_users(): hardened security definer, aal2 + admin only.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'phone',  'totp', 'verified',   now(), now(), 'x'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'backup', 'totp', 'verified',   now(), now(), 'y'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'draft',  'totp', 'unverified', now(), now(), 'z');

-- hardening -------------------------------------------------------------------------------------
select ok((select prosecdef from pg_proc where oid = 'public.admin_list_users()'::regprocedure),
  'admin_list_users is security definer');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.admin_list_users()'::regprocedure),
  'admin_list_users has an empty search_path');
select ok(not has_function_privilege('anon', 'public.admin_list_users()', 'execute'), 'anon cannot execute');
select ok(has_function_privilege('authenticated', 'public.admin_list_users()', 'execute'), 'authenticated can execute');
select ok((select proconfig @> array['search_path=""'] from pg_proc
            where oid = 'private.is_locked_object(text,text)'::regprocedure),
  'is_locked_object has an empty search_path');
select ok(not has_function_privilege('anon', 'private.is_locked_object(text,text)', 'execute'),
  'anon cannot execute is_locked_object');

-- aal1 admin -------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok('select * from public.admin_list_users()', '42501', null, 'admin with aal1 is refused');
reset role;

-- aal2 user without role ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok('select * from public.admin_list_users()', '42501', null, 'user without role is refused');
reset role;

-- aal2 admin -----------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select ok((select count(*) >= 2 from public.admin_list_users()), 'admin with aal2 lists users');
select is((select verified_totp_factors from public.admin_list_users() where email = 'admin@test.local'), 2,
  'only verified TOTP factors are counted');
select is((select roles from public.admin_list_users() where email = 'admin@test.local'),
  array['admin']::public.app_role[], 'roles are returned');
select is((select verified_totp_factors from public.admin_list_users() where email = 'nobody@test.local'), 0,
  'user without factors has 0');
reset role;

select * from finish();
