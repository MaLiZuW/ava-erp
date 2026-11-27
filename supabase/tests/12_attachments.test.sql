-- Block J (D23): attachment categories, blocked types, file check, main photo, attachments view;
-- owner's point 17: duplicate a package with its bill of materials.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

-- anon / aal1 / no role -----------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['attachment_categories','blocked_mime_types','attachments']) as t;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['attachment_categories','blocked_mime_types','attachments']) as t;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': user without role sees nothing')
from unnest(array['attachment_categories','blocked_mime_types']) as t;
reset role;

-- the view respects RLS of documents (security_invoker) -----------------------------------------
select ok((select 'security_invoker=true' = any (c.reloptions) from pg_class c
            where c.oid = 'public.attachments'::regclass), 'attachments is security_invoker');

-- admin aal2 ------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is((select count(*)::int from public.attachment_categories), 6, 'six categories are configured');
select is((select max_bytes from public.attachment_categories where code = 'photo'), 5242880::bigint,
  'photo: up to 5 MB');
select is((select max_bytes from public.attachment_categories where code = 'datasheet'), 20971520::bigint,
  'documents: up to 20 MB');
select throws_ok($$delete from public.attachment_categories where code = 'other'$$, '42501', null,
  'categories are not deleted (deactivate instead)');
select throws_ok($$insert into public.blocked_mime_types values ('text/plain', 'x')$$, '42501', null,
  'blocked types are changed only by migration');

-- a blocked type is never allowed, not even through the configuration
select throws_ok($$update public.attachment_categories set allowed_mime_types = array_append(allowed_mime_types, 'image/svg+xml')
                    where code = 'other'$$, '23514', null, 'SVG cannot be added to a category');
select throws_ok($$insert into public.attachment_categories (code, label, allowed_mime_types, max_bytes)
                   values ('web', 'Web', array['text/html'], 1000)$$, '23514', null, 'HTML cannot be allowed');
select throws_ok($$insert into public.attachment_categories (code, label, allowed_mime_types, max_bytes)
                   values ('huge', 'Veľké', array['application/pdf'], 30000000)$$, '23514', null,
  'a category limit never exceeds the 20 MB bucket cap');
-- a new allowed type is just configuration and reaches the bucket
select lives_ok($$insert into public.attachment_categories (code, label, allowed_mime_types, max_bytes)
                  values ('cad', 'CAD', array['image/vnd.dxf'], 20971520)$$, 'a new type is configuration');
reset role;
select ok((select 'image/vnd.dxf' = any (allowed_mime_types) from storage.buckets where id = 'documents'),
  'the bucket follows the categories');
select ok((select not ('image/svg+xml' = any (allowed_mime_types)) from storage.buckets where id = 'documents'),
  'the bucket never allows SVG');
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

-- file check by category ------------------------------------------------------------------------
insert into public.units (code, name) values ('ks', 'kus') on conflict do nothing;
insert into public.catalog_items (id, name, item_type, unit_code)
values ('c2000000-0000-0000-0000-000000000001', 'Probe hrnček', 'goods', 'ks'),
       ('c2000000-0000-0000-0000-000000000002', 'Probe pero', 'goods', 'ks');

select lives_ok($$insert into public.documents (id, entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('d1000000-0000-0000-0000-000000000001', 'catalog_items', 'c2000000-0000-0000-0000-000000000001', 'photo',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000001-a.webp',
          'a.webp', 'image/webp', 4000000)$$, 'photo 4 MB WebP accepted');
select lives_ok($$insert into public.documents (id, entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('d1000000-0000-0000-0000-000000000002', 'suppliers', 'c2000000-0000-0000-0000-000000000001', 'datasheet',
          '2026/suppliers/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000002-list.pdf',
          'list.pdf', 'Application/PDF', 19000000)$$, 'datasheet 19 MB PDF accepted (type lower-cased)');
select is((select mime_type from public.documents where id = 'd1000000-0000-0000-0000-000000000002'),
  'application/pdf', 'MIME type is stored lower-case');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('catalog_items', 'c2000000-0000-0000-0000-000000000001', 'photo',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-b.png',
          'b.png', 'image/png', 6000000)$$, '23514', null, 'photo over 5 MB refused');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('catalog_items', 'c2000000-0000-0000-0000-000000000001', 'photo',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-b.pdf',
          'b.pdf', 'application/pdf', 1000)$$, '23514', null, 'PDF is not a photo');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('catalog_items', 'c2000000-0000-0000-0000-000000000001', 'other',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-c.svg',
          'c.svg', 'image/svg+xml', 1000)$$, '23514', null, 'SVG refused');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('catalog_items', 'c2000000-0000-0000-0000-000000000001', 'other',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-c.exe',
          'c.exe', 'application/x-msdownload', 1000)$$, '23514', null, 'EXE refused');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('catalog_items', 'c2000000-0000-0000-0000-000000000001', 'other',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-c.pdf',
          'c.pdf', 'application/pdf', 21000000)$$, '23514', null, 'document over 20 MB refused');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('customer_contacts', 'c2000000-0000-0000-0000-000000000001', 'other',
          '2026/customer_contacts/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-c.pdf',
          'c.pdf', 'application/pdf', 1000)$$, '23514', null, 'contacts have no attachments (D22)');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('catalog_items', 'c2000000-0000-0000-0000-000000000001', 'whatever',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-c.pdf',
          'c.pdf', 'application/pdf', 1000)$$, '23514', null, 'unknown category refused');
select throws_ok($$update public.documents set category = 'photo' where id = 'd1000000-0000-0000-0000-000000000002'$$,
  '23514', null, 'changing the category re-checks the type (PDF cannot become a photo)');
select lives_ok($$update public.documents set category = 'certificate' where id = 'd1000000-0000-0000-0000-000000000002'$$,
  'category change within allowed types');
select is((select storage_provider from public.documents where id = 'd1000000-0000-0000-0000-000000000001'),
  'supabase', 'storage provider defaults to supabase');

-- inactive category: no new files
update public.attachment_categories set is_active = false where code = 'drawing';
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('catalog_items', 'c2000000-0000-0000-0000-000000000001', 'drawing',
          '2026/catalog_items/c2000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000009-d.pdf',
          'd.pdf', 'application/pdf', 1000)$$, '23514', null, 'inactive category accepts no new files');

-- main photo ------------------------------------------------------------------------------------
select lives_ok($$update public.catalog_items set main_photo_document_id = 'd1000000-0000-0000-0000-000000000001'
                   where id = 'c2000000-0000-0000-0000-000000000001'$$, 'a photo of the item is its main photo');
select throws_ok($$update public.catalog_items set main_photo_document_id = 'd1000000-0000-0000-0000-000000000001'
                    where id = 'c2000000-0000-0000-0000-000000000002'$$, '23514', null,
  'a photo of another item cannot be the main photo');
select throws_ok($$update public.catalog_items set main_photo_document_id = 'd1000000-0000-0000-0000-000000000002'
                    where id = 'c2000000-0000-0000-0000-000000000001'$$, '23514', null,
  'a document that is not a photo cannot be the main photo');
select throws_ok($$update public.documents set category = 'other' where id = 'd1000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'the main photo stays a photo');

-- the tile view
select is((select category_label from public.attachments where id = 'd1000000-0000-0000-0000-000000000001'),
  'Foto', 'attachments shows the category label');
select is((select count(*)::int from public.attachments where entity_id = 'c2000000-0000-0000-0000-000000000001'),
  2, 'attachments of one entity');

-- deleting the main photo clears it; a locked document is never deleted
select lives_ok($$delete from public.documents where id = 'd1000000-0000-0000-0000-000000000001'$$,
  'an unlocked attachment can be deleted');
select is((select main_photo_document_id from public.catalog_items where id = 'c2000000-0000-0000-0000-000000000001'),
  null, 'deleting the main photo clears it on the item');
reset role;
update public.documents set is_locked = true where id = 'd1000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$delete from public.documents where id = 'd1000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a locked attachment is never deleted');

-- point 17: duplicate a package with its BOM -----------------------------------------------------
insert into public.units (code, name) values ('bal', 'balenie') on conflict do nothing;
insert into public.catalog_items (id, name, code, item_type, unit_code, description)
values ('c2000000-0000-0000-0000-000000000010', 'Probe balíček', 'PRB-1', 'package', 'bal', 'popis');
insert into public.package_components (package_item_id, component_item_id, quantity) values
  ('c2000000-0000-0000-0000-000000000010', 'c2000000-0000-0000-0000-000000000001', 2),
  ('c2000000-0000-0000-0000-000000000010', 'c2000000-0000-0000-0000-000000000002', 1.5);
create temp table dup as
  select public.duplicate_catalog_package('c2000000-0000-0000-0000-000000000010', ' Probe balíček – kópia ', 'PRB-2') as id;
select is((select name from public.catalog_items where id = (select id from dup)), 'Probe balíček – kópia',
  'the copy has the new name (trimmed)');
select is((select (code, item_type, unit_code, description)::text from public.catalog_items where id = (select id from dup)),
  '(PRB-2,package,bal,popis)', 'the copy keeps type, unit and description with the new code');
select set_eq($$select component_item_id, quantity from public.package_components where package_item_id = (select id from dup)$$,
  $$select component_item_id, quantity from public.package_components where package_item_id = 'c2000000-0000-0000-0000-000000000010'$$,
  'the copy has the same bill of materials');
select throws_ok($$select public.duplicate_catalog_package('c2000000-0000-0000-0000-000000000010', 'X', 'PRB-2')$$,
  '23505', null, 'the code must be unique');
select throws_ok($$select public.duplicate_catalog_package('c2000000-0000-0000-0000-000000000001', 'X')$$,
  '23514', null, 'only a package can be duplicated');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select public.duplicate_catalog_package('c2000000-0000-0000-0000-000000000010', 'Y')$$,
  'P0002', null, 'a user without the admin role does not see the package');
reset role;

select * from finish();
