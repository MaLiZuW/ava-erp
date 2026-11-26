/**
 * Disposable test users for the API test and Playwright – DEV project only.
 *
 * Rules (approved phase-2 plan, D5):
 * - users are created ONLY through the Auth Admin API (secret key), never by writing auth.users;
 * - every run first removes leftovers (*@test.invalid), and the caller deletes its user in `finally`;
 * - password and TOTP secret are random per run and are never printed (not even on errors);
 * - SUPABASE_SECRET_KEY lives only in .env.local (scripts), never in NEXT_PUBLIC_* or the repository.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";
import { Client } from "pg";

/** The only project these scripts may touch. */
export const DEV_PROJECT_REF = "hkfkdomslzvpxukzhlwc";
export const TEST_EMAIL_DOMAIN = "test.invalid";

export interface TestEnv {
  url: string;
  anonKey: string;
  secretKey: string;
  dbUrl: string;
}

/** Reads .env.local and refuses to run against anything but the DEV project. */
export function loadTestEnv(opts: { optional?: boolean } = {}): TestEnv | null {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
  const dbUrl = process.env.SUPABASE_DB_URL ?? "";
  const missing = Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SECRET_KEY: secretKey,
    SUPABASE_DB_URL: dbUrl,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    if (opts.optional) return null;
    throw new Error(`Missing in .env.local: ${missing.join(", ")} (see DEPLOYMENT.md, section B).`);
  }
  if (
    !new URL(url).hostname.startsWith(`${DEV_PROJECT_REF}.`) ||
    !dbUrl.includes(DEV_PROJECT_REF)
  ) {
    throw new Error(
      `Refusing to run: test users may only be created on the DEV project (${DEV_PROJECT_REF}).`,
    );
  }
  return { url, anonKey, secretKey, dbUrl };
}

const NO_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

export function adminClient(env: TestEnv): SupabaseClient {
  return createClient(env.url, env.secretKey, NO_SESSION);
}

export function anonClient(env: TestEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, NO_SESSION);
}

/** Deletes every user on the test domain (leftovers of interrupted runs). Returns the count. */
export async function purgeTestUsers(env: TestEnv): Promise<number> {
  const admin = adminClient(env);
  let removed = 0;
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(`@${TEST_EMAIL_DOMAIN}`)) {
        const del = await admin.auth.admin.deleteUser(u.id);
        if (del.error) throw new Error(`deleteUser failed: ${del.error.message}`);
        removed++;
      }
    }
    if (data.users.length < 200) break;
  }
  return removed;
}

export interface TestUser {
  id: string;
  email: string;
  /** random per run – never log */
  password: string;
}

export function randomTestEmail(prefix: string): string {
  return `${prefix}+${randomBytes(6).toString("hex")}@${TEST_EMAIL_DOMAIN}`;
}

/** Creates a confirmed user through the Admin API and optionally grants the admin role. */
export async function createTestUser(
  env: TestEnv,
  prefix: string,
  opts: { admin?: boolean } = {},
): Promise<TestUser> {
  const email = randomTestEmail(prefix);
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await adminClient(env).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${prefix}` },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message ?? "no user"}`);
  if (opts.admin) {
    // roles live in public.user_roles (not in auth.users); the profile is created by a trigger
    const db = new Client({ connectionString: env.dbUrl });
    await db.connect();
    try {
      await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [
        data.user.id,
      ]);
    } finally {
      await db.end();
    }
  }
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(
  env: TestEnv,
  user: TestUser | null | undefined,
): Promise<void> {
  if (!user) return;
  const { error } = await adminClient(env).auth.admin.deleteUser(user.id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
}

/** Current TOTP code for a base32 secret (RFC 6238, 30 s, 6 digits – Supabase defaults). */
export function totpCode(secret: string): string {
  return new TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" }).generate();
}

/**
 * Enrolls and verifies a TOTP factor for a signed-in client. Returns the factor id and the secret
 * (secret stays in memory of the calling test – never log it).
 */
export async function enrollTotp(
  client: SupabaseClient,
  friendlyName = `test-${randomBytes(3).toString("hex")}`,
): Promise<{ factorId: string; secret: string }> {
  const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName });
  if (error || !data) throw new Error(`mfa.enroll failed: ${error?.message ?? "no data"}`);
  const secret = data.totp.secret;
  const v = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totpCode(secret) });
  if (v.error) throw new Error(`mfa.challengeAndVerify failed: ${v.error.message}`);
  return { factorId: data.id, secret };
}
