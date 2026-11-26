-- Phase 3 / block D: content library, image rule on documents, reporting settings.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');
insert into public.divisions (code, name) values ('AVENG', 'AVENG'), ('AGENCY', 'Agentúra')
  on conflict (code) do nothing;

-- fixtures (owner)
insert into public.content_blocks (key, title, body) values ('zz_probe', 'Probe', 'Text');
insert into public.overhead_costs (month, category, amount_cents) values ('2998-01-01', 'Probe nájom', 10000);
insert into public.income_tax_brackets (valid_from, revenue_from_cents, revenue_to_cents, rate_pct, source_note)
  values ('2998-01-01', 0, 100000, 10, 'probe');
insert into public.capacity_plans (user_id, month, available_hours)
  values ('a0000000-0000-0000-0000-00000000000a', '2998-01-01', 120);
insert into public.kpi_targets (kpi_key, target_value, direction, valid_from)
  values ('probe_kpi', 5, 'lower_better', '2998-01-01');

-- anon / aal1 / no role -------------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['content_blocks','overhead_costs','income_tax_brackets','capacity_plans','kpi_targets']) as t;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['content_blocks','overhead_costs','income_tax_brackets','capacity_plans','kpi_targets']) as t;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['content_blocks','overhead_costs','income_tax_brackets','capacity_plans','kpi_targets']) as t;
select throws_ok($$insert into public.kpi_targets (kpi_key, target_value, direction) values ('x_kpi', 1, 'higher_better')$$,
  '42501', null, 'user without role cannot insert');
reset role;

-- aal2 admin ----------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select isnt_empty(format('select 1 from public.%I', t), t || ': admin with aal2 can read')
from unnest(array['content_blocks','overhead_costs','income_tax_brackets','capacity_plans','kpi_targets']) as t;

-- documents: image rule (category logo / content_image)
select lives_ok($$insert into public.documents (id, entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
                  values ('d1000000-0000-0000-0000-000000000001', 'content_blocks', gen_random_uuid(), 'content_image',
                          '2026/content_blocks/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000011-a.webp',
                          'a.webp', 'image/webp', 2097152)$$,
  'content image: WebP of exactly 2 MB is accepted');
select lives_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
                  values ('content_blocks', gen_random_uuid(), 'content_image',
                          '2026/content_blocks/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000012-a.jpg',
                          'a.jpg', 'image/jpeg', 1000)$$, 'content image: JPEG is accepted');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
                   values ('content_blocks', gen_random_uuid(), 'content_image',
                           '2026/content_blocks/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000013-a.svg',
                           'a.svg', 'image/svg+xml', 100)$$, '23514', null, 'content image: SVG is refused');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
                   values ('content_blocks', gen_random_uuid(), 'content_image',
                           '2026/content_blocks/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000014-a.png',
                           'a.png', 'image/png', 2097153)$$, '23514', null, 'content image: over 2 MB is refused');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
                   values ('companies', gen_random_uuid(), 'logo',
                           '2026/companies/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000015-a.gif',
                           'a.gif', 'image/gif', 100)$$, '23514', null, 'logo: GIF is refused');
select lives_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
                  values ('jobs', gen_random_uuid(), 'attachment',
                          '2026/jobs/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000016-a.pdf',
                          'a.pdf', 'application/pdf', 5000000)$$, 'other categories are not limited by the image rule');

-- content blocks
select lives_ok($$insert into public.content_blocks (key, job_type, title, body, image_document_ids)
                  values ('service_PROMO', 'PROMO', 'Reklamné predmety', 'Text', array['d1000000-0000-0000-0000-000000000001'::uuid])$$,
  'admin can create a content block with an image');
select is((select version from public.content_blocks where key = 'service_PROMO'), 1, 'new block has version 1');
update public.content_blocks set body = 'Nový text' where key = 'service_PROMO';
select is((select version from public.content_blocks where key = 'service_PROMO'), 2, 'changed text increases the version');
update public.content_blocks set is_active = true where key = 'service_PROMO';
select is((select version from public.content_blocks where key = 'service_PROMO'), 2, 'no text change keeps the version');
update public.content_blocks set version = 99 where key = 'service_PROMO';
select is((select version from public.content_blocks where key = 'service_PROMO'), 2, 'version cannot be set by hand');
select throws_ok($$insert into public.content_blocks (key, title) values ('service_PROMO', 'Duplicita')$$,
  '23505', null, 'key + language is unique');
select lives_ok($$insert into public.content_blocks (key, title, language) values ('service_PROMO', 'Promo items', 'en')$$,
  'the same key in another language is allowed');
select throws_ok($$insert into public.content_blocks (key, title, image_document_ids)
                   values ('zz_bad_image', 'X', array[gen_random_uuid()])$$, '23503', null,
  'images must exist as content_image documents');
select throws_ok($$delete from public.content_blocks where key = 'zz_probe'$$, '42501', null,
  'content blocks are not deleted (soft delete)');

-- overhead: duplicate for the whole company (division NULL) is refused
select throws_ok($$insert into public.overhead_costs (month, category, amount_cents) values ('2998-01-01', 'Probe nájom', 1)$$,
  '23505', null, 'duplicate shared overhead (division NULL) is refused');
select lives_ok($$insert into public.overhead_costs (month, division_id, category, amount_cents)
                  select '2998-01-01', id, 'Probe nájom', 5000 from public.divisions where code = 'AVENG'$$,
  'the same category for a division is a different row');
select throws_ok($$insert into public.overhead_costs (month, category, amount_cents) values ('2998-01-15', 'X', 1)$$,
  '23514', null, 'month must be the first day');
select throws_ok($$insert into public.overhead_costs (month, category, amount_cents) values ('2998-02-01', 'X', -1)$$,
  '23514', null, 'negative overhead is refused');
select lives_ok($$delete from public.overhead_costs where category = 'Probe nájom' and division_id is not null$$,
  'admin can delete an overhead row');

-- income tax brackets
select throws_ok($$insert into public.income_tax_brackets (valid_from, revenue_from_cents, revenue_to_cents, rate_pct)
                   values ('2998-06-01', 50000, 200000, 20)$$, '23P01', null, 'overlapping bracket is refused');
select lives_ok($$insert into public.income_tax_brackets (valid_from, revenue_from_cents, rate_pct)
                  values ('2998-01-01', 100000, 20)$$, 'next bracket from the upper limit (open end) is accepted');
select throws_ok($$insert into public.income_tax_brackets (valid_from, revenue_from_cents, rate_pct) values ('2999-01-01', 0, 101)$$,
  '23514', null, 'rate above 100 % is refused');
select throws_ok($$insert into public.income_tax_brackets (valid_from, revenue_from_cents, revenue_to_cents, rate_pct)
                   values ('2999-01-01', 100, 100, 5)$$, '23514', null, 'empty revenue range is refused');
select throws_ok($$insert into public.income_tax_brackets (valid_from, revenue_from_cents, rate_pct) values ('2999-01-01', -1, 5)$$,
  '23514', null, 'negative revenue limit is refused');
select throws_ok($$delete from public.income_tax_brackets$$, '42501', null, 'tax brackets are not deleted (history)');

-- capacity
select throws_ok($$insert into public.capacity_plans (user_id, month, available_hours)
                   values ('a0000000-0000-0000-0000-00000000000a', '2998-01-01', 10)$$, '23505', null,
  'one capacity row per person and month');
select throws_ok($$insert into public.capacity_plans (user_id, month, available_hours)
                   values ('a0000000-0000-0000-0000-00000000000a', '2998-02-01', -1)$$, '23514', null,
  'negative hours are refused');

-- KPI targets: duplicate for the whole company (division NULL) is refused
select throws_ok($$insert into public.kpi_targets (kpi_key, target_value, direction, valid_from)
                   values ('probe_kpi', 7, 'lower_better', '2998-01-01')$$, '23505', null,
  'duplicate company-wide KPI target (division NULL) is refused');
select lives_ok($$insert into public.kpi_targets (kpi_key, division_id, target_value, direction, valid_from)
                  select 'probe_kpi', id, 7, 'lower_better', '2998-01-01' from public.divisions where code = 'AGENCY'$$,
  'the same KPI for a division is a different row');
select throws_ok($$insert into public.kpi_targets (kpi_key, target_value, warning_value, direction)
                   values ('quote_success', 40, 50, 'higher_better')$$, '23514', null,
  'warning threshold must be on the worse side of the target');
select throws_ok($$insert into public.kpi_targets (kpi_key, target_value, direction) values ('x_kpi', 1, 'sideways')$$,
  '23514', null, 'direction is checked');
select lives_ok($$delete from public.kpi_targets where kpi_key = 'probe_kpi' and division_id is not null$$,
  'admin can delete a KPI target');
reset role;

-- audit
select isnt_empty($$select 1 from public.activity_logs where table_name = 'content_blocks' and action = 'update'$$,
  'content block changes are logged');
select isnt_empty($$select 1 from public.activity_logs where table_name = 'kpi_targets' and action = 'delete'$$,
  'deleted KPI target is logged');

select * from finish();
