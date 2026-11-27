-- =====================================================================
-- Phase 3 – block J: attachments per D23 (+ owner's point 17: duplicate a package)
-- One "Prílohy" tile over public.documents for catalog items, customers, suppliers and
-- equipment (resources). Allowed types and limits per category are configuration in the DB;
-- dangerous types (SVG, HTML, scripts, executables) are refused always, whatever the
-- configuration says. Owner decisions 26. 11. 2026: photo 5 MB, documents 20 MB (bucket cap
-- 20 MB), PDF opens in a new tab via a signed URL (no CSP change).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. blocked_mime_types – never accepted (read-only for the app; changed only by migration)
-- ---------------------------------------------------------------------
create table public.blocked_mime_types (
  mime_type text primary key check (mime_type = lower(mime_type) and mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  note      text not null
);
insert into public.blocked_mime_types (mime_type, note) values
  ('image/svg+xml',                            'SVG môže obsahovať skript'),
  ('text/html',                                'HTML'),
  ('application/xhtml+xml',                    'XHTML'),
  ('text/xml',                                 'XML môže obsahovať skript'),
  ('application/xml',                          'XML môže obsahovať skript'),
  ('text/javascript',                          'skript'),
  ('application/javascript',                   'skript'),
  ('application/x-javascript',                 'skript'),
  ('application/x-sh',                         'skript'),
  ('application/x-csh',                        'skript'),
  ('application/x-bat',                        'skript'),
  ('application/x-httpd-php',                  'skript'),
  ('text/x-php',                               'skript'),
  ('text/x-python',                            'skript'),
  ('application/x-msdownload',                 'spustiteľný súbor'),
  ('application/x-msdos-program',              'spustiteľný súbor'),
  ('application/vnd.microsoft.portable-executable', 'spustiteľný súbor'),
  ('application/x-executable',                 'spustiteľný súbor'),
  ('application/x-elf',                        'spustiteľný súbor'),
  ('application/x-mach-binary',                'spustiteľný súbor'),
  ('application/java-archive',                 'spustiteľný súbor'),
  ('application/x-ms-installer',               'inštalačný balík'),
  ('application/x-msi',                        'inštalačný balík'),
  ('application/vnd.ms-word.document.macroenabled.12', 'dokument s makrami'),
  ('application/vnd.ms-excel.sheet.macroenabled.12',   'zošit s makrami'),
  ('application/octet-stream',                 'neznámy typ – nikdy bez určenia typu');

alter table public.blocked_mime_types enable row level security;
create policy require_aal2 on public.blocked_mime_types as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy blocked_mime_types_admin_select on public.blocked_mime_types for select to authenticated
  using ((select private.has_role('admin')));
revoke all on public.blocked_mime_types from anon, authenticated;
grant select on public.blocked_mime_types to authenticated;
grant all on public.blocked_mime_types to service_role;

-- ---------------------------------------------------------------------
-- 2. attachment_categories – allowed types and limit per category (configuration)
-- ---------------------------------------------------------------------
create table public.attachment_categories (
  code               text primary key check (code ~ '^[a-z][a-z_]{1,39}$'
                                             and code not in ('logo', 'content_image')),
  label              text not null check (length(btrim(label)) between 1 and 60),
  allowed_mime_types text[] not null check (cardinality(allowed_mime_types) between 1 and 50),
  -- never above the bucket cap (20 MB)
  max_bytes          bigint not null check (max_bytes between 1 and 20 * 1024 * 1024),
  sort_order         int not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);

-- a blocked type can never be allowed, not even by mistake in the configuration
create function private.guard_attachment_category() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.allowed_mime_types := array(select distinct lower(btrim(m)) from unnest(new.allowed_mime_types) as m);
  if exists (select 1 from unnest(new.allowed_mime_types) as m
              where m in (select b.mime_type from public.blocked_mime_types b)
                 or m !~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$') then
    raise exception 'attachment category %: a blocked or invalid file type', new.code
      using errcode = '23514', hint = 'blocked_type';
  end if;
  return new;
end;
$$;
create trigger guard_attachment_category
  before insert or update on public.attachment_categories
  for each row execute function private.guard_attachment_category();

do $$
declare
  docs text[] := array['application/pdf',
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                       'image/png', 'image/jpeg', 'image/webp'];
begin
  insert into public.attachment_categories (code, label, allowed_mime_types, max_bytes, sort_order) values
    ('photo',       'Foto',            array['image/png','image/jpeg','image/webp'], 5 * 1024 * 1024, 10),
    ('datasheet',   'Technický list',  docs, 20 * 1024 * 1024, 20),
    ('certificate', 'Certifikát',      docs, 20 * 1024 * 1024, 30),
    ('contract',    'Zmluva',          docs, 20 * 1024 * 1024, 40),
    ('drawing',     'Výkres',          docs, 20 * 1024 * 1024, 50),
    ('other',       'Iné',             docs, 20 * 1024 * 1024, 60);
end;
$$;

select private.setup_admin_table('attachment_categories', false);

-- the bucket accepts exactly the types of the categories (+ logo / content images):
-- a new type in a category (e.g. DWG later) needs no programming
create function private.sync_documents_bucket() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update storage.buckets
     set allowed_mime_types = array(
           select distinct m from (
             select unnest(c.allowed_mime_types) as m from public.attachment_categories c where c.is_active
             union select unnest(array['image/png','image/jpeg','image/webp'])
           ) t order by m),
         file_size_limit = 20 * 1024 * 1024
   where id = 'documents';
  return null;
end;
$$;
revoke all on function private.sync_documents_bucket() from public, anon, authenticated;
create trigger sync_documents_bucket
  after insert or update or delete on public.attachment_categories
  for each statement execute function private.sync_documents_bucket();

-- apply now (the trigger runs on changes only)
update storage.buckets
   set allowed_mime_types = array(
         select distinct m from (
           select unnest(c.allowed_mime_types) as m from public.attachment_categories c where c.is_active
           union select unnest(array['image/png','image/jpeg','image/webp'])
         ) t order by m),
       file_size_limit = 20 * 1024 * 1024
 where id = 'documents';

-- ---------------------------------------------------------------------
-- 3. documents: storage provider (exchangeable storage, one adapter) + file check
-- ---------------------------------------------------------------------
alter table public.documents
  add column storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase'));

-- tables that have attachments (D23); contacts never (D22 – personal data)
create function private.check_attachment_file() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c public.attachment_categories;
begin
  new.mime_type := lower(btrim(new.mime_type));
  if exists (select 1 from public.blocked_mime_types b where b.mime_type = new.mime_type) then
    raise exception 'file type % is never accepted', new.mime_type
      using errcode = '23514', hint = 'blocked_type';
  end if;
  -- logo and content images keep their own rule (constraint documents_image_files)
  if new.category in ('logo', 'content_image') then
    return new;
  end if;
  select * into c from public.attachment_categories where code = new.category;
  if not found then
    raise exception 'unknown document category %', new.category
      using errcode = '23514', hint = 'unknown_category';
  end if;
  if not c.is_active and (tg_op = 'INSERT' or new.category is distinct from old.category) then
    raise exception 'attachment category % is not active', new.category
      using errcode = '23514', hint = 'inactive_category';
  end if;
  if new.entity_table not in ('catalog_items', 'customers', 'suppliers', 'resources') then
    raise exception 'table % has no attachments', new.entity_table
      using errcode = '23514', hint = 'entity_table';
  end if;
  if not (new.mime_type = any (c.allowed_mime_types)) then
    raise exception 'file type % is not allowed in category %', new.mime_type, new.category
      using errcode = '23514', hint = 'type_not_allowed';
  end if;
  if new.size_bytes > c.max_bytes then
    raise exception 'file is larger than % bytes allowed in category %', c.max_bytes, new.category
      using errcode = '23514', hint = 'too_large';
  end if;
  -- the main photo of a catalog item stays a photo
  if tg_op = 'UPDATE' and old.category = 'photo' and new.category <> 'photo'
     and exists (select 1 from public.catalog_items i where i.main_photo_document_id = new.id) then
    raise exception 'document % is the main photo of a catalog item', new.id
      using errcode = '23514', hint = 'main_photo';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. catalog_items: main photo (for quotes and the presentation); gallery = photos of the item
-- ---------------------------------------------------------------------
alter table public.catalog_items
  add column main_photo_document_id uuid references public.documents (id) on delete set null;

create trigger check_attachment_file
  before insert or update of category, mime_type, size_bytes, entity_table on public.documents
  for each row execute function private.check_attachment_file();

create function private.check_main_photo() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.main_photo_document_id is not null and not exists (
    select 1 from public.documents d
     where d.id = new.main_photo_document_id and d.category = 'photo'
       and d.entity_table = 'catalog_items' and d.entity_id = new.id
  ) then
    raise exception 'the main photo must be a photo attached to the same item'
      using errcode = '23514', hint = 'main_photo';
  end if;
  return new;
end;
$$;
create trigger check_main_photo
  before insert or update of main_photo_document_id on public.catalog_items
  for each row execute function private.check_main_photo();

-- ---------------------------------------------------------------------
-- 5. attachments – the list for the tile (security_invoker: RLS of documents applies)
-- ---------------------------------------------------------------------
create view public.attachments with (security_invoker = true) as
select d.id,
       d.entity_table,
       d.entity_id,
       d.category,
       c.label                         as category_label,
       d.file_name,
       d.mime_type,
       d.size_bytes,
       d.storage_provider,
       d.storage_bucket,
       d.storage_path,
       d.is_locked,
       d.created_at,
       d.created_by,
       coalesce(p.full_name, p.email)  as created_by_name
  from public.documents d
  join public.attachment_categories c on c.code = d.category
  left join public.profiles p on p.id = d.created_by;
revoke all on public.attachments from anon;
grant select on public.attachments to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Owner's point 17: "Duplikovať balíček" – a copy with its bill of materials
--    (security invoker: the caller's RLS applies; attachments are not copied)
-- ---------------------------------------------------------------------
create function public.duplicate_catalog_package(p_id uuid, p_name text, p_code text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  src public.catalog_items;
  new_id uuid;
begin
  select * into src from public.catalog_items where id = p_id;
  if not found then
    raise exception 'catalog item % not found', p_id using errcode = 'P0002';
  end if;
  if src.item_type <> 'package' then
    raise exception 'only a package can be duplicated' using errcode = '23514', hint = 'not_package';
  end if;
  insert into public.catalog_items (name, code, item_type, division_id, unit_code, default_cost_cents,
                                    default_supplier_id, default_pricing_mode, default_pricing_pct,
                                    description, is_active)
  values (btrim(p_name), nullif(btrim(coalesce(p_code, '')), ''), src.item_type, src.division_id,
          src.unit_code, src.default_cost_cents, src.default_supplier_id, src.default_pricing_mode,
          src.default_pricing_pct, src.description, true)
  returning id into new_id;
  insert into public.package_components (package_item_id, component_item_id, quantity)
  select new_id, pc.component_item_id, pc.quantity
    from public.package_components pc
   where pc.package_item_id = p_id;
  return new_id;
end;
$$;
revoke all on function public.duplicate_catalog_package(uuid, text, text) from public, anon;
grant execute on function public.duplicate_catalog_package(uuid, text, text) to authenticated;
