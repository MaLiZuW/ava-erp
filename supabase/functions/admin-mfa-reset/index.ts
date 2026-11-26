// Supabase Edge Function (Deno). Deploy: npx supabase functions deploy admin-mfa-reset --use-api
// Env provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (never logged).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handle, type Deps } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const noSession = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

// verification client (public key) and privileged client (service role, only inside this function)
const verifier = createClient(url, anonKey, noSession);
const admin = createClient(url, serviceKey, noSession);

const deps: Deps = {
  async verifyToken(token) {
    // getClaims verifies the signature (JWKS) and expiry; for symmetric keys it asks the Auth server
    const { data, error } = await verifier.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return {
      sub: String(data.claims.sub),
      aal: data.claims.aal ? String(data.claims.aal) : undefined,
    };
  },
  async isActiveAdmin(userId) {
    const { data, error } = await admin
      .from("user_roles")
      .select("role, profiles!inner(is_active)")
      .eq("user_id", userId)
      .eq("role", "admin")
      .eq("profiles.is_active", true)
      .maybeSingle();
    return !error && !!data;
  },
  async getUserEmail(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    return data.user.email ?? "";
  },
  async deleteAllFactors(userId) {
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
    if (error) throw new Error("list_factors_failed");
    let removed = 0;
    for (const f of data?.factors ?? []) {
      const del = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
      if (del.error) throw new Error("delete_factor_failed");
      removed++;
    }
    return removed;
  },
  async audit({ actor, target, targetEmail, removed }) {
    // activity_logs is append-only; no factor ids or secrets are stored
    const { error } = await admin.from("activity_logs").insert({
      table_name: "auth.mfa_factors",
      record_id: target,
      action: "delete",
      old_data: { target_user: targetEmail, factors_removed: removed },
      note: "MFA reset by administrator (lost or replaced phone)",
      actor,
    });
    if (error) throw new Error("audit_failed");
  },
  log: (m) => console.log(m),
};

Deno.serve(async (req) => {
  try {
    return await handle(req, deps);
  } catch (e) {
    // only a generic code – never the request, token or stack with data
    console.log(`admin-mfa-reset 500 ${e instanceof Error ? e.message : "error"}`);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" },
    });
  }
});
