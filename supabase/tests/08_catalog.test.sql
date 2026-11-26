-- Phase 3 / block C: units, catalog, packages (one level), labour rates, resources.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

-- fixtures (owner)
insert into public.catalog_items (id, code, name, item_type, unit_code, default_cost_cents) values
  ('e0000000-0000-0000-0000-000000000001', 'T-PKG',  'Probe balíček',  'package', 'bal', 0),
  ('e0000000-0000-0000-0000-000000000002', 'T-CUP',  'Probe hrnček',   'goods',   'ks',  250),
  ('e0000000-0000-0000-0000-000000000003', 'T-PKG2', 'Probe balíček 2', 'package', 'bal', 0),
  ('e0000000-0000-0000-0000-000000000004', 'T-BAG',  'Probe taška',    'goods',   'ks',  120);
insert into public.labor_roles (id, name) values ('f0000000-0000-0000-0000-000000000001', 'Probe konzultant');
insert into public.labor_rates (role_id, cost_rate_cents, bill_rate_cents, valid_from, valid_to) values
  ('f0000000-0000-0000-0000-000000000001', 4000, 6000, '2026-01-01', '2026-12-31');
insert into public.resources (id, name, purchase_cost_cents, expected_life_hours, operating_cost_per_hour_cents)
  values ('ab000000-0000-0000-0000-000000000001', 'Probe plotter', 1000000, 3000, 150);

-- reference data from the migration
select is((select count(*) from public.units where code in ('ks','hod','bal','m','m2','kg','km','paušál')),
  8::bigint, 'the 8 units from DATABASE_SCHEMA.md exist');

-- anon / aal1 / no role ------------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['units','catalog_items','package_components','labor_roles','labor_rates','resources']) as t;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['units','catalog_items','package_components','labor_roles','labor_rates','resources']) as t;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['units','catalog_items','package_components','labor_roles','labor_rates','resources']) as t;
select throws_ok($$insert into public.labor_roles (name) values ('x')$$, '42501', null,
  'user without role cannot insert');
reset role;

-- aal2 admin ---------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select isnt_empty(format('select 1 from public.%I', t), t || ': admin with aal2 can read')
from unnest(array['units','catalog_items','labor_roles','labor_rates','resources']) as t;

-- catalog items
select lives_ok($$insert into public.catalog_items (code, name, item_type, unit_code, default_cost_cents,
                                                    default_pricing_mode, default_pricing_pct)
                  values ('T-PEN', 'Pero', 'goods', 'ks', 80, 'markup', 25)$$,
  'admin can insert a catalog item with markup');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, default_cost_cents)
                   values ('Záporné', 'goods', 'ks', -1)$$, '23514', null, 'negative cost is refused');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, default_pricing_mode, default_pricing_pct)
                   values ('Marža 100', 'goods', 'ks', 'margin', 100)$$, '23514', null, 'margin of 100 % is refused');
select lives_ok($$insert into public.catalog_items (name, item_type, unit_code, default_pricing_mode, default_pricing_pct)
                  values ('Marža 99,99', 'goods', 'ks', 'margin', 99.99)$$, 'margin below 100 % is accepted');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, default_pricing_mode, default_pricing_pct)
                   values ('Záporná prirážka', 'goods', 'ks', 'markup', -5)$$, '23514', null, 'negative percentage is refused');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, default_pricing_mode)
                   values ('Bez %', 'goods', 'ks', 'markup')$$, '23514', null, 'markup without a percentage is refused');
select throws_ok($$insert into public.catalog_items (code, name, item_type, unit_code) values ('T-CUP', 'Dup', 'goods', 'ks')$$,
  '23505', null, 'item code is unique');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code) values ('Neznáma jednotka', 'goods', 'xx')$$,
  '23503', null, 'unit must exist');
select throws_ok($$delete from public.catalog_items where code = 'T-PEN'$$, '42501', null,
  'catalog items are not deleted (soft delete)');

-- packages: one level only
select lives_ok($$insert into public.package_components (package_item_id, component_item_id, quantity)
                  values ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 2)$$,
  'a goods item can be a package component');
select throws_ok($$insert into public.package_components (package_item_id, component_item_id, quantity)
                   values ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 1)$$,
  '23514', null, 'a package cannot contain another package');
select throws_ok($$insert into public.package_components (package_item_id, component_item_id, quantity)
                   values ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 1)$$,
  '23514', null, 'only a package can have components');
select throws_ok($$insert into public.package_components (package_item_id, component_item_id, quantity)
                   values ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1)$$,
  '23514', null, 'a package cannot contain itself');
select throws_ok($$insert into public.package_components (package_item_id, component_item_id, quantity)
                   values ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 0)$$,
  '23514', null, 'component quantity must be > 0');
select throws_ok($$update public.catalog_items set item_type = 'package' where id = 'e0000000-0000-0000-0000-000000000002'$$,
  '23514', null, 'a component cannot become a package');
select throws_ok($$update public.catalog_items set item_type = 'goods' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'a package with components cannot change its type');
select lives_ok($$update public.package_components set quantity = 3
                  where package_item_id = 'e0000000-0000-0000-0000-000000000001'$$, 'component quantity can change');
select lives_ok($$delete from public.package_components
                  where package_item_id = 'e0000000-0000-0000-0000-000000000001'$$, 'admin can remove a component');

-- units: used units cannot be removed
select throws_ok($$delete from public.units where code = 'ks'$$, '23503', null, 'a used unit cannot be deleted');
select lives_ok($$insert into public.units (code, name) values ('l', 'liter')$$, 'admin can add a unit');
select lives_ok($$delete from public.units where code = 'l'$$, 'admin can delete an unused unit');

-- labour rates: no overlapping periods for the same role
select throws_ok($$insert into public.labor_rates (role_id, cost_rate_cents, bill_rate_cents, valid_from)
                   values ('f0000000-0000-0000-0000-000000000001', 4500, 6500, '2026-06-01')$$,
  '23P01', null, 'overlapping rate period is refused');
select lives_ok($$insert into public.labor_rates (role_id, cost_rate_cents, bill_rate_cents, valid_from)
                  values ('f0000000-0000-0000-0000-000000000001', 4500, 6500, '2027-01-01')$$,
  'next period starting after the previous one ends is accepted');
select throws_ok($$insert into public.labor_rates (role_id, cost_rate_cents, bill_rate_cents, valid_from, valid_to)
                   values ('f0000000-0000-0000-0000-000000000001', 1, 1, '2025-02-01', '2025-01-01')$$,
  '23514', null, 'valid_to before valid_from is refused');
select throws_ok($$insert into public.labor_rates (role_id, cost_rate_cents, bill_rate_cents, valid_from, valid_to)
                   values ('f0000000-0000-0000-0000-000000000001', -1, 1, '2020-01-01', '2020-12-31')$$,
  '23514', null, 'negative rate is refused');
select throws_ok($$insert into public.labor_roles (name) values ('probe KONZULTANT')$$, '23505', null,
  'role names are unique (case-insensitive)');
select throws_ok($$delete from public.labor_rates$$, '42501', null, 'rates are not deleted (history)');

-- resources: generated cost rate
select is((select cost_rate_cents from public.resources where id = 'ab000000-0000-0000-0000-000000000001'),
  483::bigint, '10 000,00 € / 3000 h + 1,50 €/h = 4,83 €/h (333,33 → 333 + 150)');
select lives_ok($$insert into public.resources (id, name, purchase_cost_cents, expected_life_hours, operating_cost_per_hour_cents)
                  values ('ab000000-0000-0000-0000-000000000002', 'Half', 5, 2, 0)$$, 'resource with 5 cents / 2 h');
select is((select cost_rate_cents from public.resources where id = 'ab000000-0000-0000-0000-000000000002'),
  3::bigint, '2,5 cents rounds half up to 3');
select lives_ok($$update public.resources set expected_life_hours = 0.4 where id = 'ab000000-0000-0000-0000-000000000002'$$,
  'life hours with decimals');
select is((select cost_rate_cents from public.resources where id = 'ab000000-0000-0000-0000-000000000002'),
  13::bigint, '5 / 0.4 = 12.5 → 13');
select throws_ok($$insert into public.resources (name, expected_life_hours) values ('Nula', 0)$$,
  '23514', null, 'expected_life_hours = 0 is refused (division by zero)');
select throws_ok($$insert into public.resources (name, expected_life_hours, purchase_cost_cents) values ('Záporná', 10, -1)$$,
  '23514', null, 'negative purchase cost is refused');
select throws_ok($$insert into public.resources (name, expected_life_hours, bill_rate_cents) values ('Záporná', 10, -1)$$,
  '23514', null, 'negative bill rate is refused');
select throws_ok($$update public.resources set cost_rate_cents = 1$$, '428C9', null, 'cost rate cannot be set by hand');
reset role;

-- audit
select is((select count(*) from public.activity_logs where table_name = 'resources'
            and record_id = 'ab000000-0000-0000-0000-000000000002'), 2::bigint, 'resource insert and update are logged');
select isnt_empty($$select 1 from public.activity_logs where table_name = 'package_components' and action = 'delete'$$,
  'removing a package component is logged');

select * from finish();
