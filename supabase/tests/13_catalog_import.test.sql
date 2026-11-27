-- Block K (D26): currencies, EAN / GTIN, purchase price in a currency with / without VAT and its
-- history, matching, import batches (dry run, apply, roll back).
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');
insert into public.units (code, name) values ('ks', 'kus'), ('bal', 'balenie') on conflict do nothing;

-- anon / aal1 / no role -----------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['currencies','catalog_item_costs','import_templates','import_batches','import_batch_rows']) as t;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['currencies','catalog_item_costs','import_templates','import_batches','import_batch_rows']) as t;
select throws_ok($$select public.dry_run_import_batch(gen_random_uuid())$$, '42501', null,
  'import functions need aal2');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['currencies','catalog_item_costs','import_templates','import_batches']) as t;
select throws_ok($$select public.rollback_import_batch(gen_random_uuid())$$, '42501', null,
  'rollback needs the admin role');
reset role;

-- GTIN check digit -------------------------------------------------------------------------------
select ok(private.gtin_valid('96385074'), 'EAN-8 valid');
select ok(private.gtin_valid('036000291452'), 'GTIN-12 (UPC-A) valid');
select ok(private.gtin_valid('4006381333931'), 'EAN-13 valid');
select ok(private.gtin_valid('10012345678902'), 'GTIN-14 valid');
select ok(not private.gtin_valid('4006381333932'), 'wrong check digit refused');
select ok(not private.gtin_valid('400638133393'), '12 digits with a wrong check digit refused');
select ok(not private.gtin_valid('123456789'), '9 digits refused');
select ok(not private.gtin_valid('40063813339A1'), 'letters refused');

-- price conversion: exact cents, half up ---------------------------------------------------------
select is(private.cost_to_eur_cents(100000, 21, 25), 3306::bigint, '1 000 CZK with 21 % VAT at 25 CZK/EUR = 33,06 €');
select is(private.cost_to_eur_cents(250, 0, 1), 250::bigint, 'EUR without VAT stays');
select is(private.cost_to_eur_cents(12300, 23, 1), 10000::bigint, '123 € with 23 % VAT = 100 €');
select is(private.cost_to_eur_cents(5, 0, 2), 3::bigint, '0,05 / 2 = 0,025 → 0,03 (half up)');
select is(private.cost_to_eur_cents(100000, 0, 4.25), 23529::bigint, '1 000 PLN at 4,25 = 235,29 €');

-- admin aal2 ------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select set_eq($$select code::text from public.currencies$$, array['EUR','CZK','PLN'], 'currencies EUR, CZK, PLN');
insert into public.suppliers (id, name) values
  ('51000000-0000-0000-0000-000000000001', 'Probe dodávateľ CZ'),
  ('51000000-0000-0000-0000-000000000002', 'Probe dodávateľ SK');

-- items: EAN and supplier code optional, unique
insert into public.catalog_items (id, name, item_type, unit_code, default_supplier_id, supplier_item_code, ean,
                                  cost_original_amount)
values ('c3000000-0000-0000-0000-000000000001', 'Probe hrnček biely', 'goods', 'ks',
        '51000000-0000-0000-0000-000000000001', 'HR-01', '4006381333931', 250);
select is((select default_cost_cents from public.catalog_items where id = 'c3000000-0000-0000-0000-000000000001'),
  250::bigint, 'EUR price without VAT = default cost');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, ean) values ('X', 'goods', 'ks', '4006381333932')$$,
  '23514', null, 'invalid EAN refused');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, ean) values ('X', 'goods', 'ks', '04006381333931')$$,
  '23505', null, 'the same GTIN written with 14 digits is a duplicate');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, default_supplier_id, supplier_item_code)
                   values ('X', 'goods', 'ks', '51000000-0000-0000-0000-000000000001', 'hr-01')$$,
  '23505', null, 'the same supplier code for one supplier is refused (case-insensitive)');
select lives_ok($$insert into public.catalog_items (name, item_type, unit_code, default_supplier_id, supplier_item_code)
                  values ('Probe iný', 'goods', 'ks', '51000000-0000-0000-0000-000000000002', 'HR-01')$$,
  'the same code at another supplier is fine');
select lives_ok($$insert into public.catalog_items (name, item_type, unit_code) values ('Probe bez kódov 1', 'goods', 'ks'),
                  ('Probe bez kódov 2', 'goods', 'ks')$$, 'many items without EAN and code');

-- currency and VAT
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, cost_currency, cost_original_amount)
                   values ('X', 'goods', 'ks', 'CZK', 1000)$$, '23514', null, 'a foreign currency needs a rate and its date');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, cost_includes_vat, cost_original_amount)
                   values ('X', 'goods', 'ks', true, 1000)$$, '23514', null, 'a price with VAT needs the VAT rate');
select throws_ok($$insert into public.catalog_items (name, item_type, unit_code, cost_currency, cost_original_amount, cost_fx_rate, cost_fx_date)
                   values ('X', 'goods', 'ks', 'USD', 1000, 1, '2026-11-27')$$, '23503', null, 'unknown currency refused');
update public.catalog_items
   set cost_currency = 'CZK', cost_original_amount = 100000, cost_fx_rate = 25, cost_fx_date = '2026-11-27',
       cost_includes_vat = true, cost_vat_rate_pct = 21
 where id = 'c3000000-0000-0000-0000-000000000001';
select is((select default_cost_cents from public.catalog_items where id = 'c3000000-0000-0000-0000-000000000001'),
  3306::bigint, 'the EUR price without VAT is computed by the database');
select is((select count(*)::int from public.catalog_item_costs where item_id = 'c3000000-0000-0000-0000-000000000001'),
  2, 'every price change is in the history');
select is((select source from public.catalog_item_costs where item_id = 'c3000000-0000-0000-0000-000000000001'
            order by created_at desc, cost_cents limit 1), 'manual', 'a manual change is marked manual');
select throws_ok($$update public.catalog_item_costs set cost_cents = 1$$, '42501', null, 'history cannot be rewritten');
update public.catalog_items set description = 'popis' where id = 'c3000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.catalog_item_costs where item_id = 'c3000000-0000-0000-0000-000000000001'),
  2, 'a change without a new price adds no history');

-- matching: supplier code → EAN → name ----------------------------------------------------------
select is((select reason from public.match_catalog_item('51000000-0000-0000-0000-000000000001', 'hr-01', null, 'nič')),
  'supplier_code', 'supplier + code first');
select is((select reason from public.match_catalog_item(null, null, '04006381333931', 'nič')), 'ean',
  'then EAN (also written with 14 digits)');
select is((select name from public.match_catalog_item(null, null, null, 'Probe hrnček biely') limit 1),
  'Probe hrnček biely', 'then a similar name');
select is_empty($$select 1 from public.match_catalog_item(null, null, null, 'Úplne iná vec xyz')$$,
  'nothing similar = new item');

-- import batch: dry run changes nothing, apply, roll back -----------------------------------------
insert into public.import_batches (id, supplier_id, file_name, options)
values ('1b000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'cennik.csv',
        '{"currency":"CZK","includes_vat":true,"vat_rate_pct":21,"fx_rate":25,"fx_date":"2026-11-27"}');
insert into public.import_batch_rows (batch_id, row_no, parsed) values
  ('1b000000-0000-0000-0000-000000000001', 1, '{"name":"Probe hrnček biely","supplier_item_code":"HR-01","price":"121000"}'),
  ('1b000000-0000-0000-0000-000000000001', 2, '{"name":"Probe pero modré","supplier_item_code":"PE-02","ean":"96385074","price":"2500","unit_code":"ks"}'),
  ('1b000000-0000-0000-0000-000000000001', 3, '{"name":"","price":"100"}'),
  ('1b000000-0000-0000-0000-000000000001', 4, '{"name":"Probe chybný EAN","ean":"4006381333932","price":"100"}'),
  ('1b000000-0000-0000-0000-000000000001', 5, '{"name":"Probe hrnček bielý","price":"100"}');

create temp table before_items as select id, default_cost_cents from public.catalog_items;
select is(public.dry_run_import_batch('1b000000-0000-0000-0000-000000000001') ->> 'update_cost', '1',
  'dry run: one price update (supplier code)');
select set_eq($$select id, default_cost_cents from public.catalog_items$$, $$select * from before_items$$,
  'dry run changes nothing in the catalog');
select is((select action from public.import_batch_rows where batch_id = '1b000000-0000-0000-0000-000000000001' and row_no = 2),
  'create', 'unknown item = new');
select is((select action from public.import_batch_rows where batch_id = '1b000000-0000-0000-0000-000000000001' and row_no = 3),
  'error', 'missing name = error');
select ok((select errors::text like '%EAN%' from public.import_batch_rows
            where batch_id = '1b000000-0000-0000-0000-000000000001' and row_no = 4), 'invalid EAN = error with a message');
select is((select action from public.import_batch_rows where batch_id = '1b000000-0000-0000-0000-000000000001' and row_no = 5),
  'choose', 'only a similar name = the user decides');
select throws_ok($$select public.apply_import_batch('1b000000-0000-0000-0000-000000000001')$$, '23514', null,
  'apply waits for the decisions');
update public.import_batch_rows set decision = 'skip'
 where batch_id = '1b000000-0000-0000-0000-000000000001' and row_no = 5;
select lives_ok($$select public.apply_import_batch('1b000000-0000-0000-0000-000000000001')$$, 'apply');
select is((select default_cost_cents from public.catalog_items where id = 'c3000000-0000-0000-0000-000000000001'),
  4000::bigint, 'updated price: 1 210 CZK with VAT at 25 = 40,00 €');
select is((select (cost_source, cost_import_batch_id)::text from public.catalog_items
            where id = 'c3000000-0000-0000-0000-000000000001'),
  '(import,1b000000-0000-0000-0000-000000000001)', 'the price has its source and batch');
select is((select (default_supplier_id, ean, cost_currency)::text from public.catalog_items where name = 'Probe pero modré'),
  '(51000000-0000-0000-0000-000000000001,96385074,CZK)', 'new item: supplier of the batch, EAN, currency');
select is((select default_cost_cents from public.catalog_items where name = 'Probe pero modré'),
  83::bigint, 'new item: 25 CZK with VAT at 25 = 0,83 €');
select is((select source from public.catalog_item_costs c join public.catalog_items i on i.id = c.item_id
            where i.name = 'Probe pero modré'), 'import', 'history of the new item says import');
select throws_ok($$update public.import_batch_rows set decision = 'create'
                    where batch_id = '1b000000-0000-0000-0000-000000000001'$$, '42501', null,
  'rows of an applied batch are history');
select throws_ok($$delete from public.import_batches where id = '1b000000-0000-0000-0000-000000000001'$$, '42501', null,
  'an applied batch is never deleted');

-- a later manual change blocks the roll back of that row
update public.catalog_items set cost_original_amount = 130000 where id = 'c3000000-0000-0000-0000-000000000001';
select throws_ok($$select public.rollback_import_batch('1b000000-0000-0000-0000-000000000001')$$, '23514', null,
  'roll back refused after a later price change');
reset role;
update public.catalog_items set cost_original_amount = 121000, cost_source = 'import',
       cost_import_batch_id = '1b000000-0000-0000-0000-000000000001'
 where id = 'c3000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.rollback_import_batch('1b000000-0000-0000-0000-000000000001'),
  '{"removed": 1, "restored": 1}'::jsonb, 'roll back: one item removed, one price restored');
select is_empty($$select 1 from public.catalog_items where name = 'Probe pero modré'$$, 'the created item is gone');
select is((select (default_cost_cents, cost_currency, cost_source)::text from public.catalog_items
            where id = 'c3000000-0000-0000-0000-000000000001'),
  '(3306,CZK,rollback)', 'the previous price is back');
select is((select status from public.import_batches where id = '1b000000-0000-0000-0000-000000000001'),
  'rolled_back', 'the batch is rolled back');
select throws_ok($$select public.rollback_import_batch('1b000000-0000-0000-0000-000000000001')$$, '23514', null,
  'a batch is rolled back only once');

-- an item used in a package is not removed by a roll back
insert into public.import_batches (id, file_name, options) values ('1b000000-0000-0000-0000-000000000002', 'b.csv', '{}');
insert into public.import_batch_rows (batch_id, row_no, parsed)
values ('1b000000-0000-0000-0000-000000000002', 1, '{"name":"Probe komponent nový","price":"500"}');
select lives_ok($$select public.apply_import_batch('1b000000-0000-0000-0000-000000000002')$$, 'apply EUR batch');
insert into public.catalog_items (id, name, item_type, unit_code) values ('c3000000-0000-0000-0000-000000000009', 'Probe balík', 'package', 'bal');
insert into public.package_components (package_item_id, component_item_id, quantity)
select 'c3000000-0000-0000-0000-000000000009', id, 1 from public.catalog_items where name = 'Probe komponent nový';
select throws_ok($$select public.rollback_import_batch('1b000000-0000-0000-0000-000000000002')$$, '23514', null,
  'roll back refused when an imported item is used');

-- item types of the enum are accepted, a package is never imported
insert into public.import_batches (id, file_name, options) values ('1b000000-0000-0000-0000-000000000004', 'd.csv', '{}');
insert into public.import_batch_rows (batch_id, row_no, parsed) values
  ('1b000000-0000-0000-0000-000000000004', 1, '{"name":"Probe služba xy","price":"100","item_type":"external_service"}'),
  ('1b000000-0000-0000-0000-000000000004', 2, '{"name":"Probe ostatné xy","price":"100","item_type":"other"}'),
  ('1b000000-0000-0000-0000-000000000004', 3, '{"name":"Probe balík xy","price":"100","item_type":"package"}');
select is(public.dry_run_import_batch('1b000000-0000-0000-0000-000000000004') ->> 'error', '1',
  'external_service and other are accepted, package is refused');

-- options are checked
insert into public.import_batches (id, file_name, options) values ('1b000000-0000-0000-0000-000000000003', 'c.csv', '{"currency":"CZK"}');
select throws_ok($$select public.dry_run_import_batch('1b000000-0000-0000-0000-000000000003')$$, '23514', null,
  'a foreign currency batch needs a rate');
select lives_ok($$delete from public.import_batches where id = '1b000000-0000-0000-0000-000000000003'$$,
  'a draft batch can be deleted');
reset role;

select * from finish();
