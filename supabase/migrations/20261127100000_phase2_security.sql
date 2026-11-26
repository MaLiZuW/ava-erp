-- =====================================================================
-- Phase 2 – security: documents + private storage bucket, notification
-- recipients, admin_list_users(), v_open_items skeleton.
-- Source of truth: docs/DATABASE_SCHEMA.md (sections 2, 3, 13, 14),
--                  docs/steps/STEP-02-bezpecnost.md, approved phase-2 plan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. notification_recipients (DATABASE_SCHEMA.md section 2)
-- ---------------------------------------------------------------------
create table public.notification_recipients (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  event_types text[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create unique index notification_recipients_email_uq on public.notification_recipients (lower(email));

-- ---------------------------------------------------------------------
-- 2. documents (DATABASE_SCHEMA.md section 3)
-- ---------------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  entity_table    text not null check (entity_table ~ '^[a-z_]+$'),
  entity_id       uuid not null,
  category        text not null check (category ~ '^[a-z_]+$'),
  storage_bucket  text not null default 'documents',
  storage_path    text not null check (storage_path ~ '^[0-9]{4}/[a-z_]+/[0-9a-f-]{36}/[0-9a-f-]{36}-[^/]+$'),
  file_name       text not null check (length(file_name) between 1 and 255),
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes >= 0),
  sha256          text check (sha256 ~ '^[0-9a-f]{64}$'),
  version         int not null default 1 check (version >= 1),
  is_locked       boolean not null default false,
  retention_until date,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  unique (storage_bucket, storage_path)
);
create index documents_entity_idx on public.documents (entity_table, entity_id);

-- A locked document (generated/issued) can never be changed or removed.
create function private.protect_locked_document() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.is_locked then
    raise exception 'document % is locked', old.id using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger protect_locked_document
  before update or delete on public.documents
  for each row execute function private.protect_locked_document();

alter table public.companies
  add constraint companies_logo_document_fk
  foreign key (logo_document_id) references public.documents (id) on delete restrict;

-- ---------------------------------------------------------------------
-- 3. Triggers: audit columns + change log on the new tables
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['notification_recipients','documents']
  loop
    execute format('create trigger set_updated before insert or update on public.%I
                    for each row execute function private.set_updated()', t);
    execute format('create trigger log_change after insert or update or delete on public.%I
                    for each row execute function private.log_change()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy require_aal2 on public.%I as restrictive to authenticated
                      using ((select auth.jwt() ->> 'aal') = 'aal2')
                      with check ((select auth.jwt() ->> 'aal') = 'aal2')$p$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RLS – admin only
-- ---------------------------------------------------------------------
create policy notification_recipients_admin_select on public.notification_recipients
  for select to authenticated using ((select private.has_role('admin')));
create policy notification_recipients_admin_insert on public.notification_recipients
  for insert to authenticated with check ((select private.has_role('admin')));
create policy notification_recipients_admin_update on public.notification_recipients
  for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

create policy documents_admin_select on public.documents
  for select to authenticated using ((select private.has_role('admin')));
create policy documents_admin_insert on public.documents
  for insert to authenticated with check ((select private.has_role('admin')));
create policy documents_admin_update on public.documents
  for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
-- delete of an unlocked document only; locked rows are stopped by the trigger
create policy documents_admin_delete on public.documents
  for delete to authenticated using ((select private.has_role('admin')));

revoke all on public.notification_recipients, public.documents from anon;
grant select, insert, update on public.notification_recipients to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.notification_recipients, public.documents to service_role;

-- ---------------------------------------------------------------------
-- 5. Storage: private bucket "documents" (phase 2: logo – PNG/JPEG/WebP, max 2 MB, no SVG)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 2 * 1024 * 1024,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- true when the storage object belongs to a locked document
create function private.is_locked_object(p_bucket text, p_path text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
     where d.storage_bucket = p_bucket and d.storage_path = p_path and d.is_locked
  );
$$;
revoke all on function private.is_locked_object(text, text) from public, anon;
grant execute on function private.is_locked_object(text, text) to authenticated;

-- No UPDATE policy on purpose: overwriting / upsert is never allowed (new version = new object).
create policy documents_bucket_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and (select auth.jwt() ->> 'aal') = 'aal2'
         and (select private.has_role('admin')));
create policy documents_bucket_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and (select auth.jwt() ->> 'aal') = 'aal2'
              and (select private.has_role('admin'))
              and not private.is_locked_object(bucket_id, name));
create policy documents_bucket_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
         and (select auth.jwt() ->> 'aal') = 'aal2'
         and (select private.has_role('admin'))
         and not private.is_locked_object(bucket_id, name));

-- ---------------------------------------------------------------------
-- 6. admin_list_users(): users, roles and verified TOTP factors (Settings → Users and 2FA)
-- ---------------------------------------------------------------------
create function public.admin_list_users()
returns table (
  user_id               uuid,
  email                 text,
  full_name             text,
  is_active             boolean,
  roles                 public.app_role[],
  verified_totp_factors int,
  last_sign_in_at       timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' or not private.has_role('admin') then
    raise exception 'admin_list_users_forbidden: authenticated aal2 admin required' using errcode = '42501';
  end if;

  return query
  select p.id,
         p.email,
         p.full_name,
         p.is_active,
         coalesce((select array_agg(ur.role order by ur.role)
                     from public.user_roles ur where ur.user_id = p.id), '{}'::public.app_role[]),
         (select count(*)::int
            from auth.mfa_factors f
           where f.user_id = p.id
             and f.factor_type::text = 'totp'
             and f.status::text = 'verified'),
         u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
   order by p.email;
end;
$$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------
-- 7. v_open_items – dashboard counters (skeleton: zeros until the modules exist)
-- ---------------------------------------------------------------------
create view public.v_open_items with (security_invoker = true) as
select 0::int as new_inquiries,
       0::int as quotes_to_approve,
       0::int as visuals_waiting,
       0::int as overdue_tasks,
       0::int as delivered_not_invoiced,
       0::int as invoices_overdue
 where (select auth.jwt() ->> 'aal') = 'aal2';

revoke all on public.v_open_items from anon, public;
grant select on public.v_open_items to authenticated, service_role;
