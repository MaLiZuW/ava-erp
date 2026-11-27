// Supabase Edge Function (Deno). Deploy: npx supabase functions deploy ai-gateway --use-api
// Env provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (never logged).
// The AI API key is NOT an env variable: it lives in Vault, set by the owner in Settings → AI.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handle, type Budget, type Deps } from "./handler.ts";
import { geminiProvider } from "./provider.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const noSession = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const verifier = createClient(url, anonKey, noSession);
const admin = createClient(url, serviceKey, noSession);
const gemini = geminiProvider();

const deps: Deps = {
  async verifyToken(token) {
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
  async storeKey(provider, key, userId) {
    const { data, error } = await admin.rpc("ai_store_key", {
      p_provider: provider,
      p_secret: key,
      p_user: userId,
    });
    if (error) throw new Error("store_key_failed");
    return String(data);
  },
  async deleteKey(provider, userId) {
    const { data, error } = await admin.rpc("ai_delete_key", {
      p_provider: provider,
      p_user: userId,
    });
    if (error) throw new Error("delete_key_failed");
    return !!data;
  },
  async getKey(provider) {
    const { data, error } = await admin.rpc("ai_get_key", { p_provider: provider });
    if (error) throw new Error("get_key_failed");
    return (data as string | null) ?? null;
  },
  async getSettings() {
    const { data, error } = await admin
      .from("system_settings")
      .select("key, value")
      .in("key", ["ai_provider", "ai_models"]);
    if (error) throw new Error("settings_failed");
    const get = (k: string) => data?.find((r) => r.key === k)?.value;
    return {
      provider: String(get("ai_provider") ?? "gemini"),
      models: (get("ai_models") ?? {}) as Record<string, string>,
    };
  },
  async isFlagOn(key) {
    const { data } = await admin
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    return !!data?.enabled;
  },
  async getPrice(model) {
    const { data } = await admin
      .from("ai_model_prices")
      .select("input_eur_per_mtok, output_eur_per_mtok")
      .eq("model", model)
      .maybeSingle();
    return data
      ? {
          input_eur_per_mtok: Number(data.input_eur_per_mtok),
          output_eur_per_mtok: Number(data.output_eur_per_mtok),
        }
      : null;
  },
  async getBudget() {
    const { data, error } = await admin.rpc("ai_budget_status").single();
    if (error || !data) throw new Error("budget_failed");
    const b = data as Record<string, unknown>;
    return {
      spent_eur: Number(b.spent_eur),
      limit_eur: Number(b.limit_eur),
      cutoff_eur: Number(b.cutoff_eur),
      pct: Number(b.pct),
      state: String(b.state) as Budget["state"],
    };
  },
  async recordUsage(row) {
    const { error } = await admin.from("ai_usage").insert(row);
    if (error) throw new Error("usage_failed");
  },
  provider(name) {
    if (name === "gemini") return gemini;
    throw new Error("unknown_provider");
  },
  log: (m) => console.log(m),
};

Deno.serve(async (req) => {
  try {
    return await handle(req, deps);
  } catch (e) {
    console.log(`ai-gateway 500 ${e instanceof Error ? e.message : "error"}`);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" },
    });
  }
});
