/**
 * Runs the Supabase CLI against the DB in SUPABASE_DB_URL (.env.local) – no `supabase login`/`link` needed.
 *   node --env-file=.env.local scripts/supabase-remote.mjs db push [--dry-run] [--yes]
 *   node --env-file=.env.local scripts/supabase-remote.mjs gen types --lang typescript --out src/core/supabase/database.types.ts
 * Windows only (cmd expands %SUPABASE_DB_URL%, so the secret never appears in our own output).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is not set (.env.local).");
  process.exit(2);
}
let args = process.argv.slice(2);
let out;
const i = args.indexOf("--out");
if (i >= 0) {
  out = args[i + 1];
  args = args.filter((_, k) => k !== i && k !== i + 1);
}
const cmd = `npx supabase ${args.join(" ")} --remote "%SUPABASE_DB_URL%"`;
const r = spawnSync(cmd, {
  shell: true,
  encoding: "utf8",
  stdio: out ? ["inherit", "pipe", "inherit"] : "inherit",
});
if (r.error) console.error(r.error.message);
if (out && r.status === 0) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, r.stdout, "utf8");
  console.log(`written ${out}`);
}
process.exit(r.status ?? 1);
