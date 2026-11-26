/**
 * Local sandbox: runs migrations + seed + pgTAP tests on PGlite (Postgres compiled to WASM, in memory).
 * No Docker, no Supabase project needed – useful for a fast check while writing SQL.
 * The authoritative run is `npm run db:test` against the dev project.
 * Supabase pieces (auth schema, roles, default grants) are stubbed below.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
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
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                    nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
  grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  -- Supabase default privileges for objects created in public
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

async function main() {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm, pgtap } });
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
