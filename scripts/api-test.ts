/**
 * API test against the DEV project's REST endpoint with the public anon key only (= an anonymous visitor).
 * Gate of phase 1: without a signed-in aal2 session the database returns no data.
 * (The aal1 path is covered by pgTAP with simulated JWT claims; a real aal1 token needs a user – phase 2.)
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!base || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (.env.local).",
  );
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const TABLES = [
  "companies",
  "divisions",
  "profiles",
  "user_roles",
  "feature_flags",
  "system_settings",
  "number_series",
  "status_transitions",
  "activity_logs",
];

let failures = 0;
const report = (ok: boolean, msg: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
};

async function main() {
  for (const t of TABLES) {
    const res = await fetch(`${base}/rest/v1/${t}?select=*&limit=5`, { headers });
    const body = await res.text();
    // acceptable: refused (401/403/404) or an empty result – never any row
    let rows = 0;
    try {
      const parsed = JSON.parse(body);
      rows = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      /* non-JSON error body */
    }
    report(rows === 0, `anon GET ${t}: HTTP ${res.status}, rows returned: ${rows}`);
  }

  for (const [fn, payload] of [
    ["next_document_number", { p_doc_type: "CP" }],
    [
      "transition",
      { p_entity_table: "jobs", p_id: "00000000-0000-0000-0000-000000000000", p_to_status: "x" },
    ],
  ] as const) {
    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    report(!res.ok, `anon RPC ${fn} refused: HTTP ${res.status}`);
  }

  const w = await fetch(`${base}/rest/v1/system_settings`, {
    method: "POST",
    headers,
    body: JSON.stringify({ key: "anon_probe", value: 1 }),
  });
  report(!w.ok, `anon INSERT refused: HTTP ${w.status}`);

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
