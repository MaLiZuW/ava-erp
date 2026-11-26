-- documents + private storage bucket "documents": locking, no overwrite, admin + aal2 only.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

-- the Storage API sets this flag for its own deletes; with it, RLS alone decides
set local storage.allow_delete_query = 'true';

-- bucket configuration (enforced by the Storage API on upload) ---------------------------------
select is((select public from storage.buckets where id = 'documents'), false, 'bucket documents is private');
select is((select file_size_limit from storage.buckets where id = 'documents'), 2097152::bigint,
  'bucket size limit is 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'documents'),
  array['image/png','image/jpeg','image/webp'], 'only PNG, JPEG and WebP are allowed (no SVG)');

-- fixtures as owner: one locked and one unlocked document with their objects ---------------------
insert into storage.objects (bucket_id, name) values
  ('documents', '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001-locked.png'),
  ('documents', '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002-free.png');
insert into public.documents (id, entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes, is_locked)
values
  ('d0000000-0000-0000-0000-000000000001', 'companies', '00000000-0000-0000-0000-000000000001', 'logo',
   '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001-locked.png',
   'locked.png', 'image/png', 10, true),
  ('d0000000-0000-0000-0000-000000000002', 'companies', '00000000-0000-0000-0000-000000000001', 'logo',
   '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002-free.png',
   'free.png', 'image/png', 10, false),
  -- locked document whose object is gone (e.g. removed by the owner via the dashboard)
  ('d0000000-0000-0000-0000-000000000003', 'companies', '00000000-0000-0000-0000-000000000001', 'logo',
   '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000004-orphan.png',
   'orphan.png', 'image/png', 10, true);

-- documents table: locked rows are immutable even for the owner --------------------------------
select throws_ok($$update public.documents set file_name = 'x.png' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'locked document cannot be updated (owner)');
select throws_ok($$delete from public.documents where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'locked document cannot be deleted (owner)');
select throws_ok($$update public.documents set is_locked = false where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'locked document cannot be unlocked');
select throws_ok($$insert into public.documents (entity_table, entity_id, category, storage_path, file_name, mime_type, size_bytes)
                   values ('companies', gen_random_uuid(), 'logo', '../../etc/passwd', 'x', 'image/png', 1)$$,
  '23514', null, 'storage_path must follow YYYY/<table>/<id>/<uuid>-<name>');

-- anon -----------------------------------------------------------------------------------------
set local role anon;
select throws_ok('select 1 from public.documents', '42501', null, 'anon cannot read documents');
select is_empty($$select 1 from storage.objects where bucket_id = 'documents'$$, 'anon sees no objects');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('documents', '2026/companies/x/anon.png')$$,
  '42501', null, 'anon cannot upload');
reset role;

-- aal1 admin ------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty($$select 1 from storage.objects where bucket_id = 'documents'$$, 'admin with aal1 sees no objects');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('documents', '2026/companies/x/aal1.png')$$,
  '42501', null, 'admin with aal1 cannot upload');
delete from storage.objects where bucket_id = 'documents';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'documents'), 2::bigint,
  'admin with aal1 deleted nothing');

-- aal2 user without role ------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty($$select 1 from storage.objects where bucket_id = 'documents'$$, 'user without role sees no objects');
select is_empty('select 1 from public.documents', 'user without role sees no documents');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('documents', '2026/companies/x/norole.png')$$,
  '42501', null, 'user without role cannot upload');
reset role;

-- aal2 admin --------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'documents'), 2::bigint, 'admin with aal2 sees objects');
select lives_ok($$insert into storage.objects (bucket_id, name)
                  values ('documents', '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000003-new.png')$$,
  'admin with aal2 can upload a new object');

-- overwrite / upsert is never allowed (no UPDATE policy)
update storage.objects set metadata = '{"tampered":true}'
 where name like '%10000000-0000-0000-0000-000000000002-free.png';
update storage.objects set metadata = '{"tampered":true}'
 where name like '%10000000-0000-0000-0000-000000000001-locked.png';
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('documents', '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002-free.png')
                   on conflict (bucket_id, name collate "C") where archived_at is null do update set metadata = '{"upsert":true}'$$,
  '42501', null, 'upsert over an existing object is refused');

-- locked object cannot be deleted; unlocked one can
delete from storage.objects where name like '%10000000-0000-0000-0000-000000000001-locked.png';
delete from storage.objects where name like '%10000000-0000-0000-0000-000000000002-free.png';

-- a locked document's path cannot be uploaded again, even when its object is gone
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('documents', '2026/companies/00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000004-orphan.png')$$,
  '42501', null, 'path of a locked document cannot be uploaded again');

-- documents through the API role
select throws_ok($$update public.documents set file_name = 'x.png' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'admin cannot update a locked document');
select lives_ok($$update public.documents set is_locked = true where id = 'd0000000-0000-0000-0000-000000000002'$$,
  'admin can lock an unlocked document');
reset role;

select is_empty($$select 1 from storage.objects where metadata ? 'tampered' or metadata ? 'upsert'$$,
  'no object was overwritten (update and upsert changed nothing)');
select is((select count(*) from storage.objects
            where name like '%10000000-0000-0000-0000-000000000001-locked.png'), 1::bigint,
  'locked object survived the delete');
select is((select count(*) from storage.objects
            where name like '%10000000-0000-0000-0000-000000000002-free.png'), 0::bigint,
  'unlocked object was deleted');
select is((select count(*) from public.activity_logs where table_name = 'documents'
            and record_id = 'd0000000-0000-0000-0000-000000000002' and action = 'update'), 1::bigint,
  'locking a document is in the change log');

select * from finish();
