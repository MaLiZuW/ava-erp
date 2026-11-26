/**
 * admin-mfa-reset – removes all TOTP factors of ANOTHER user (lost phone).
 * Pure request handling with injected dependencies, so it is unit-tested in Vitest
 * (handler.test.ts); index.ts wires it to Deno and Supabase.
 *
 * Rules (approved phase-2 plan, D4):
 * - the caller's JWT is VERIFIED (signature + expiry) – never just decoded;
 * - aal comes from the verified claims, the admin role from the database (active profile);
 * - a user cannot reset themselves; the target must exist;
 * - CORS only for the application origins;
 * - nothing secret is ever logged (token, body, factor details) – only status and ids.
 */

export const ALLOWED_ORIGINS = new Set([
  "https://app.av-agency.sk",
  "http://localhost:3000",
  "http://localhost:3100",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VerifiedClaims {
  sub: string;
  aal?: string;
}

export interface Deps {
  /** verifies signature and expiry; null when the token is invalid */
  verifyToken(token: string): Promise<VerifiedClaims | null>;
  /** true when the user has the admin role and an active profile */
  isActiveAdmin(userId: string): Promise<boolean>;
  /** e-mail of the target or null when the user does not exist */
  getUserEmail(userId: string): Promise<string | null>;
  /** deletes all factors of the user, returns how many were removed */
  deleteAllFactors(userId: string): Promise<number>;
  audit(entry: {
    actor: string;
    target: string;
    targetEmail: string;
    removed: number;
  }): Promise<void>;
  log(message: string): void;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const origin = req.headers.get("Origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: Record<string, unknown>) => {
    deps.log(`admin-mfa-reset ${status}${body.error ? ` ${String(body.error)}` : ""}`);
    return new Response(JSON.stringify(body), { status, headers });
  };

  // browsers always send Origin on cross-origin requests; a foreign origin is refused outright
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(401, { error: "missing_token" });

  const claims = await deps.verifyToken(token).catch(() => null);
  if (!claims?.sub) return reply(401, { error: "invalid_token" });
  if (claims.aal !== "aal2") return reply(403, { error: "aal2_required" });
  if (!(await deps.isActiveAdmin(claims.sub))) return reply(403, { error: "admin_required" });

  let target: unknown;
  try {
    target = ((await req.json()) as { user_id?: unknown })?.user_id;
  } catch {
    return reply(400, { error: "invalid_body" });
  }
  if (typeof target !== "string" || !UUID.test(target))
    return reply(400, { error: "invalid_user_id" });
  if (target.toLowerCase() === claims.sub.toLowerCase())
    return reply(400, { error: "cannot_reset_self" });

  const email = await deps.getUserEmail(target);
  if (email === null) return reply(404, { error: "user_not_found" });

  const removed = await deps.deleteAllFactors(target);
  await deps.audit({ actor: claims.sub, target, targetEmail: email, removed });
  return reply(200, { removed });
}
