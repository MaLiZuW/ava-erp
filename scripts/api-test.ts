/**
 * API test against the DEV project's REST endpoint – direct HTTP queries, no UI.
 *
 * Gate of phase 2: without a second factor there is no data, not even through the API.
 *  1. anon key only (anonymous visitor)            → no rows, writes and RPC refused
 *  2. real user, password only  (aal1 access token) → no rows, writes and RPC refused
 *  3. same user after TOTP       (aal2 access token) → admin sees data
 *  4. Auth settings: public sign-up, anonymous sign-ins and other providers are disabled
 *  5. Edge Function admin-mfa-reset: aal1, foreign origin, self-reset and unknown user are refused
 *
 * The test user is created through the Auth Admin API (secret key, .env.local only), with a random
 * password and TOTP secret, and is deleted in `finally`. Leftovers (*@test.invalid) are removed first.
 */
import { randomUUID } from "node:crypto";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  enrollTotp,
  loadTestEnv,
  purgeTestUsers,
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
  // phase 3 – master data
  "customers",
  "customer_contacts",
  "customer_machines",
  "suppliers",
  "supplier_contacts",
  "units",
  "catalog_items",
  "package_components",
  "labor_roles",
  "labor_rates",
  "resources",
  "content_blocks",
  "overhead_costs",
  "income_tax_brackets",
  "kpi_targets",
  "resource_kinds",
  "bookable_resources",
  "work_patterns",
  "calendar_exceptions",
  "public_holidays",
  "v_resource_capacity_monthly",
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

    // 4. Storage – content images follow the image rule (PNG/JPEG/WebP ≤ 2 MB) -----------------------
    console.log("\n-- Storage: content images (aal2 admin) --");
    const folder = `${new Date().getFullYear()}/content_blocks/${randomUUID()}`;
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
        "1f15c4890000000d49444154789c6300010000050001" +
        "0d0a2db40000000049454e44ae426082",
      "hex",
    );
    const store = client.storage.from("documents");
    const okUp = await store.upload(`${folder}/${randomUUID()}-ok.png`, png, {
      contentType: "image/png",
      upsert: false,
    });
    report(!okUp.error, `PNG content image uploads${okUp.error ? `: ${okUp.error.message}` : ""}`);
    const svg = await store.upload(
      `${folder}/${randomUUID()}-x.svg`,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      { contentType: "image/svg+xml", upsert: false },
    );
    report(!!svg.error, "SVG upload is refused by the bucket");
    const big = await store.upload(
      `${folder}/${randomUUID()}-big.png`,
      Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]),
      { contentType: "image/png", upsert: false },
    );
    report(!!big.error, "upload over 2 MB is refused by the bucket");
    if (okUp.data?.path) await store.remove([okUp.data.path]);

    // 5. Edge Function admin-mfa-reset ----------------------------------------------------------------
    console.log("\n-- Edge Function admin-mfa-reset --");
    const fnUrl = `${env.url}/functions/v1/admin-mfa-reset`;
    const call = (token: string, body: unknown, origin = "http://localhost:3000") =>
      fetch(fnUrl, {
        method: "POST",
        headers: {
          apikey: env.anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify(body),
      });
    const probeRes = await call(s2.session!.access_token, {
      user_id: "00000000-0000-4000-8000-000000000000",
    });
    if (probeRes.status === 404 && !(await probeRes.text()).includes("user_not_found")) {
      console.log(
        "SKIP Edge Function is not deployed (DEPLOYMENT.md, section F) – reset checks not run",
      );
    } else {
      report(probeRes.status === 404, `aal2 admin, unknown target → 404 (got ${probeRes.status})`);
      const self = await call(s2.session!.access_token, { user_id: user.id });
      report(self.status === 400, `aal2 admin resetting themselves → 400 (got ${self.status})`);
      const foreign = await call(
        s2.session!.access_token,
        { user_id: user.id },
        "https://evil.example",
      );
      report(foreign.status === 403, `foreign Origin → 403 (got ${foreign.status})`);
      const c1 = anonClient(env);
      const s1 = await c1.auth.signInWithPassword({ email: user.email, password: user.password });
      const aal1Res = await call(s1.data.session!.access_token, {
        user_id: "00000000-0000-4000-8000-000000000000",
      });
      report(
        aal1Res.status === 403 || aal1Res.status === 401,
        `aal1 token → refused (got ${aal1Res.status})`,
      );
      const forged = await call(`${s2.session!.access_token.slice(0, -4)}AAAA`, {
        user_id: user.id,
      });
      report(forged.status === 401, `tampered token → 401 (got ${forged.status})`);
    }

    // 4. Auth settings (public endpoint, no user is created) ----------------------------------------
    // a sign-up attempt with a test address is not proof: Supabase may reject the address itself
    console.log("\n-- Auth settings --");
    const st = await fetch(`${env.url}/auth/v1/settings`, { headers: { apikey: env.anonKey } });
    const settings = (await st.json()) as {
      disable_signup?: boolean;
      external?: Record<string, boolean>;
    };
    report(
      settings.disable_signup === true,
      `public sign-up disabled (disable_signup = ${settings.disable_signup})`,
    );
    report(settings.external?.anonymous_users === false, "anonymous sign-ins disabled");
    const providers = Object.entries(settings.external ?? {})
      .filter(([k, v]) => v && k !== "email" && k !== "anonymous_users")
      .map(([k]) => k);
    report(
      providers.length === 0,
      `only the e-mail provider is enabled${providers.length ? ` (also: ${providers.join(", ")})` : ""}`,
    );
  } finally {
    await deleteTestUser(env, user);
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
