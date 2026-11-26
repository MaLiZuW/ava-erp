-- transition() + block_direct_status_update() on a throw-away table (rolled back after the test).
select * from no_plan();

create type public.zz_doc_status as enum ('draft', 'sent', 'accepted', 'rejected');
create table public.zz_docs (
  id     uuid primary key default gen_random_uuid(),
  status public.zz_doc_status not null default 'draft'
);
create trigger block_direct_status_update before update on public.zz_docs
  for each row execute function private.block_direct_status_update();
grant select, update on public.zz_docs to authenticated;

create function private.zz_guard_ok(p_id uuid) returns boolean language sql as $$ select true $$;
create function private.zz_guard_fail(p_id uuid) returns boolean language sql as $$ select false $$;

insert into public.status_transitions (entity_table, from_status, to_status, label_sk, is_primary, required_role, guard_fn) values
  ('zz_docs', 'draft',    'sent',     'Odoslať',   true,  'admin',      null),
  ('zz_docs', 'draft',    'rejected', 'Zamietnuť', false, 'admin',      null),
  ('zz_docs', 'sent',     'accepted', 'Prijať',    true,  'admin',      'zz_guard_ok'),
  ('zz_docs', 'sent',     'rejected', 'Zamietnuť', false, 'admin',      'zz_guard_fail'),
  ('zz_docs', 'rejected', 'draft',    'Obnoviť',   false, 'accountant', null);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');
insert into public.zz_docs (id) values ('d0000000-0000-0000-0000-000000000001');

-- direct status changes are blocked --------------------------------------------------------
select throws_ok($$update public.zz_docs set status = 'accepted'$$, '42501', null,
  'direct status update is blocked (owner)');
select lives_ok($$update public.zz_docs set id = id$$, 'updating without changing status is fine');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$update public.zz_docs set status = 'accepted'$$, '42501', null,
  'direct status update is blocked (authenticated admin)');

-- allowed transition + audit + next steps ---------------------------------------------------
select is((public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'sent', 'poslané')
           -> 'next_steps' -> 0 ->> 'to_status'),
  'accepted', 'transition returns the next possible steps');
select is((select status::text from public.zz_docs), 'sent', 'status was changed');
reset role;
select is((select count(*) from public.activity_logs
            where table_name = 'zz_docs' and action = 'transition'
              and from_status = 'draft' and to_status = 'sent' and note = 'poslané'
              and actor = 'a0000000-0000-0000-0000-00000000000a'),
  1::bigint, 'transition is written to the audit log with actor and note');
select is((select count(*) from public.activity_logs where table_name = 'zz_docs' and action = 'update'),
  0::bigint, 'no duplicate generic update log for a transition');

-- not allowed / guard ------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'draft')$$,
  'P0001', null, 'transition not defined in status_transitions is refused');
select throws_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'rejected')$$,
  'P0001', null, 'guard returning false blocks the transition');
select is((select status::text from public.zz_docs), 'sent', 'status unchanged after refused transitions');
select lives_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'accepted')$$,
  'guard returning true lets the transition pass');

-- unknown entity / row ------------------------------------------------------------------------
select throws_ok($$select public.transition('profiles', 'd0000000-0000-0000-0000-000000000001', 'x')$$,
  '22023', null, 'tables not registered in status_transitions cannot be touched');
select throws_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-0000000000ff', 'sent')$$,
  'P0002', null, 'unknown row is reported');
reset role;

-- role and aal2 requirements ---------------------------------------------------------------------
update public.zz_docs set id = id; -- no-op sanity
select set_config('app.in_transition', 'on', true);
update public.zz_docs set status = 'rejected';                -- owner-side setup of the fixture state
select set_config('app.in_transition', 'off', true);

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'draft')$$,
  'admin may perform transitions that need a lower role');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'sent')$$,
  '42501', null, 'user without the required role is refused');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'sent')$$,
  '42501', null, 'aal1 session cannot perform transitions even as admin');
reset role;

set local role anon;
select throws_ok($$select public.transition('zz_docs', 'd0000000-0000-0000-0000-000000000001', 'sent')$$,
  '42501', null, 'anon cannot call transition');
reset role;

select * from finish();
