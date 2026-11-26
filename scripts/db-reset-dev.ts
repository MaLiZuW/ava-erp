/**
 * DESTRUCTIVE – removes everything the project's migrations created on the DEV project and clears the
 * migration history, so that `npm run db:push` can rebuild the database from scratch.
 *
 * Hard guards:
 *  - the connection user must be exactly postgres.<DEV_REF> (ava-erp-dev) – any other project aborts;
 *  - the caller must pass --confirm=<DEV_REF>;
 *  - aborts if auth.users contains users or if public holds tables we do not know;
 *  - touches only known objects (never drops schema public, so Supabase default grants stay intact);
 *  - everything runs in ONE transaction (all or nothing).
 *
 * Usage: node --env-file=.env.local ... or `npm run db:reset:dev -- --confirm=hkfkdomslzvpxukzhlwc`
 */
import { Client } from "pg";
import { describeTarget, requireDbUrl } from "./lib/env";

const DEV_REF = "hkfkdomslzvpxukzhlwc";

const KNOWN_TABLES = [
  "activity_logs",
  "companies",
  "divisions",
  "feature_flags",
  "number_series",
  "profiles",
  "status_transitions",
  "system_settings",
  "user_roles",
];
const KNOWN_FUNCTIONS = [
  "public.transition(text, uuid, text, text)",
  "public.next_document_number(public.doc_type, int)",
];
const KNOWN_ENUMS = [
  "app_role",
  "division_code",
  "job_type",
  "party_kind",
  "inquiry_source",
  "inquiry_status",
  "quote_version_status",
  "item_type",
  "pricing_mode",
  "job_status",
  "visual_status",
  "supplier_rfq_status",
  "po_status",
  "delivery_doc_kind",
  "delivery_doc_status",
  "invoice_kind",
  "invoice_status",
  "received_inv_status",
  "received_inv_source",
  "payment_direction",
  "task_status",
  "email_direction",
  "doc_type",
];

async function main() {
  const url = requireDbUrl();
  const user = decodeURIComponent(new URL(url).username);
  console.log(`target: ${describeTarget(url)}`);
  if (user !== `postgres.${DEV_REF}`) {
    console.error(
      `ABORT: connection user is "${user}", expected "postgres.${DEV_REF}" (dev project only).`,
    );
    process.exit(3);
  }
  if (!process.argv.includes(`--confirm=${DEV_REF}`)) {
    console.error(`ABORT: pass --confirm=${DEV_REF} to proceed.`);
    process.exit(3);
  }

  const c = new Client({ connectionString: url, connectionTimeoutMillis: 20000 });
  await c.connect();
  try {
    const users = Number((await c.query("select count(*) from auth.users")).rows[0].count);
    if (users > 0) throw new Error(`auth.users contains ${users} user(s) – refusing to reset.`);

    const tables: string[] = (
      await c.query(
        "select table_name from information_schema.tables where table_schema = 'public'",
      )
    ).rows.map((r) => r.table_name);
    const unknown = tables.filter((t) => !KNOWN_TABLES.includes(t));
    if (unknown.length)
      throw new Error(`unknown tables in public: ${unknown.join(", ")} – refusing to reset.`);

    await c.query("begin");
    await c.query("drop trigger if exists on_auth_user_created on auth.users");
    for (const t of KNOWN_TABLES) await c.query(`drop table if exists public.${t} cascade`);
    // private functions use the enums (has_role(app_role)), so the schema goes before the types
    await c.query("drop schema if exists private cascade");
    for (const f of KNOWN_FUNCTIONS) await c.query(`drop function if exists ${f}`);
    for (const e of KNOWN_ENUMS) await c.query(`drop type if exists public.${e}`);
    await c.query("delete from supabase_migrations.schema_migrations");

    const left = (
      await c.query(
        "select (select count(*) from information_schema.tables where table_schema='public') t, " +
          "(select count(*) from pg_type ty join pg_namespace n on n.oid=ty.typnamespace where n.nspname='public' and ty.typtype='e') e, " +
          "(select count(*) from pg_namespace where nspname='private') p",
      )
    ).rows[0];
    if (Number(left.t) + Number(left.e) + Number(left.p) !== 0)
      throw new Error(`leftovers after reset: ${JSON.stringify(left)}`);
    await c.query("commit");
    console.log(
      "reset done: public tables/enums/functions, schema private and migration history removed.",
    );
  } catch (e) {
    await c.query("rollback").catch(() => {});
    console.error("ROLLED BACK:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
