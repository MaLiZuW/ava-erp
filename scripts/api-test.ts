/**
 * API test against the DEV project's REST endpoint – direct HTTP queries, no UI.
 *
 * Gate of phase 2: without a second factor there is no data, not even through the API.
 *  1. anon key only (anonymous visitor)            → no rows, writes and RPC refused
 *  2. real user, password only  (aal1 access token) → no rows, writes and RPC refused
 *  3. same user after TOTP       (aal2 access token) → admin sees data
 *  4. public sign-up is disabled
 *
 * The test user is created through the Auth Admin API (secret key, .env.local only), with a random
 * password and TOTP secret, and is deleted in `finally`. Leftovers (*@test.invalid) are removed first.
 */
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  enrollTotp,
  loadTestEnv,
  purgeTestUsers,
  randomTestEmail,
  type TestUser,
} from "./lib/test-users";

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
  "notification_recipients",
  "documents",
  "v_open_items",
];
/** tables an aal2 admin must see rows in (seeded / always present) */
const ADMIN_VISIBLE = [
  "companies",
  "divisions",
  "profiles",
  "user_roles",
  "feature_flags",
  "v_open_items",
];

let failures = 0;
const report = (ok: boolean, msg: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
};

async function countRows(res: Response): Promise<number> {
  try {
    const parsed: unknown = JSON.parse(await res.text());
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function makeApi(base: string, apikey: string, bearer: string) {
  const headers = { apikey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" };
  return {
    get: (t: string) => fetch(`${base}/rest/v1/${t}?select=*&limit=5`, { headers }),
    rpc: (fn: string, payload: unknown) =>
      fetch(`${base}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    insert: (t: string, row: unknown) =>
      fetch(`${base}/rest/v1/${t}`, { method: "POST", headers, body: JSON.stringify(row) }),
  };
}

async function expectNoAccess(label: string, api: ReturnType<typeof makeApi>) {
  for (const t of TABLES) {
    const res = await api.get(t);
    const rows = await countRows(res);
    report(rows === 0, `${label} GET ${t}: HTTP ${res.status}, rows returned: ${rows}`);
  }
  for (const [fn, payload] of [
    ["next_document_number", { p_doc_type: "CP" }],
    [
      "transition",
      { p_entity_table: "jobs", p_id: "00000000-0000-0000-0000-000000000000", p_to_status: "x" },
    ],
    ["admin_list_users", {}],
  ] as const) {
    const res = await api.rpc(fn, payload);
    report(!res.ok, `${label} RPC ${fn} refused: HTTP ${res.status}`);
  }
  const w = await api.insert("system_settings", { key: "api_probe", value: 1 });
  report(!w.ok, `${label} INSERT system_settings refused: HTTP ${w.status}`);
}

async function main() {
  const env = loadTestEnv();
  if (!env) return;
  const removed = await purgeTestUsers(env);
  console.log(`cleanup: removed ${removed} leftover test user(s)\n`);

  // 1. anonymous ---------------------------------------------------------------------------------
  await expectNoAccess("anon", makeApi(env.url, env.anonKey, env.anonKey));

  let user: TestUser | null = null;
  let probe: string | null = null;
  try {
    // 2. aal1 – password only ---------------------------------------------------------------------
    user = await createTestUser(env, "api-test", { admin: true });
    const client = anonClient(env);
    const signIn = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (signIn.error || !signIn.data.session)
      throw new Error(`sign-in failed: ${signIn.error?.message}`);
    const aal1 = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    report(
      aal1.data?.currentLevel === "aal1",
      `password sign-in gives aal1 (got ${aal1.data?.currentLevel})`,
    );
    console.log("\n-- admin with aal1 token (password only) --");
    await expectNoAccess("aal1", makeApi(env.url, env.anonKey, signIn.data.session.access_token));

    // 3. aal2 – after TOTP ------------------------------------------------------------------------
    await enrollTotp(client);
    const { data: s2 } = await client.auth.getSession();
    const aal2 = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    report(
      aal2.data?.currentLevel === "aal2",
      `TOTP verification gives aal2 (got ${aal2.data?.currentLevel})`,
    );
    console.log("\n-- admin with aal2 token --");
    const api2 = makeApi(env.url, env.anonKey, s2.session!.access_token);
    for (const t of ADMIN_VISIBLE) {
      const res = await api2.get(t);
      const rows = await countRows(res);
      report(res.ok && rows > 0, `aal2 admin GET ${t}: HTTP ${res.status}, rows: ${rows}`);
    }
    const lu = await api2.rpc("admin_list_users", {});
    const list = (await lu.json()) as { email: string; verified_totp_factors: number }[];
    const me = Array.isArray(list) ? list.find((u) => u.email === user!.email) : undefined;
    report(
      lu.ok && me?.verified_totp_factors === 1,
      `aal2 admin RPC admin_list_users: HTTP ${lu.status}`,
    );
    const n = await api2.rpc("next_document_number", { p_doc_type: "CP" });
    report(!n.ok, `aal2 admin still cannot call next_document_number directly: HTTP ${n.status}`);

    // 4. public sign-up must be disabled -----------------------------------------------------------
    probe = randomTestEmail("signup-probe");
    const su = await anonClient(env).auth.signUp({ email: probe, password: `${probe}-Aa1!` });
    report(
      !!su.error && !su.data.user,
      `public sign-up refused${su.error ? ` (${su.error.code ?? su.error.message})` : " – SIGN-UP IS ENABLED"}`,
    );
  } finally {
    await deleteTestUser(env, user);
    // a sign-up probe that slipped through is removed by the purge
    const left = await purgeTestUsers(env);
    if (left > 0) console.log(`cleanup: removed ${left} more test user(s)`);
  }

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  // never print secrets: only the message
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
