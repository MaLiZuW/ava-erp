/**
 * Local sandbox: runs migrations + seed + pgTAP tests on PGlite (Postgres compiled to WASM, in memory).
 * No Docker, no Supabase project needed – useful for a fast check while writing SQL.
 * The authoritative run is `npm run db:test` against the dev project.
 * Supabase pieces (auth schema, roles, default grants) are stubbed below.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgtap } from "@electric-sql/pglite-pgtap";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listTestFiles, printReports, runTapFile, type SqlExec } from "./lib/tap";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb,
                           last_sign_in_at timestamptz);
  create table auth.mfa_factors (id uuid primary key, user_id uuid not null references auth.users (id),
                                 friendly_name text, factor_type text not null, status text not null,
                                 created_at timestamptz not null, updated_at timestamptz not null, secret text);
  -- storage (shape taken from the dev project, phase 2): buckets, versioned objects, RLS, delete guard
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
                                file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
                                name text, owner uuid, metadata jsonb, version text, archived_at timestamptz,
                                is_versioned boolean not null default false,
                                created_at timestamptz default now(), updated_at timestamptz default now());
  create unique index idx_objects_current_version on storage.objects (bucket_id, name collate "C") where archived_at is null;
  alter table storage.objects enable row level security;
  create function storage.protect_delete() returns trigger language plpgsql as $$
  begin
    if coalesce(current_setting('storage.allow_delete_query', true), 'false') != 'true' then
      raise exception 'Direct deletion from storage tables is not allowed' using errcode = '42501';
    end if;
    return null;
  end $$;
  create trigger protect_objects_delete before delete on storage.objects
    for each statement execute function storage.protect_delete();
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
  grant select on storage.buckets to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                    nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
  grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  -- Functions keep Supabase's default grants (so our explicit REVOKEs are tested).
  -- Tables get NO default grants: the migration has to grant explicitly (stricter than Supabase today).
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function main() {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm, btree_gist, pgtap } });
  const exec: SqlExec = async (sql) => {
    const results = await db.exec(sql);
    return results.flatMap((r) =>
      r.rows.map((row) => String(Object.values(row as object)[0] ?? "")),
    );
  };

  await db.exec(SUPABASE_STUB);

  const migDir = join("supabase", "migrations");
  for (const f of readdirSync(migDir)
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(migDir, f), "utf8"));
    console.log(`migration applied: ${f}`);
  }
  const seed = readFileSync(join("supabase", "seed.sql"), "utf8");
  await db.exec(seed);
  await db.exec(seed); // idempotency check
  console.log("seed applied twice (idempotent)\n");

  const reports = [];
  for (const { file, sql } of listTestFiles(join("supabase", "tests"))) {
    reports.push(await runTapFile(exec, file, sql));
  }
  process.exit(printReports(reports) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
