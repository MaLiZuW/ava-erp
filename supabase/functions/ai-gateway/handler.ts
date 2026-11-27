/**
 * ai-gateway – the only place that talks to the AI provider (D25). Pure request handling with
 * injected dependencies (unit-tested in handler.test.ts); index.ts wires it to Deno and Supabase.
 *
 * Actions (admin with aal2 only):
 *   set_key         – stores / replaces the API key in Vault; returns only the last 4 characters
 *   delete_key      – removes it
 *   test_connection – a minimal call to the chosen model; recorded in ai_usage
 * Every AI call (runGenerate – later used by the catalog assistant and the e-mail triage) checks:
 * the feature flag, the chosen model, its price (without a price the fuse cannot count) and the
 * budget fuse; usage is recorded; nothing secret (key, content) is ever logged.
 */
import { costEur, ProviderError, type AiPart, type AiProvider } from "./provider.ts";

export const ALLOWED_ORIGINS = new Set([
  "https://app.av-agency.sk",
  "http://localhost:3000",
  "http://localhost:3100",
]);

export type BudgetState = "ok" | "warn50" | "warn90" | "blocked";
export interface Budget {
  spent_eur: number;
  limit_eur: number;
  cutoff_eur: number;
  pct: number;
  state: BudgetState;
}
export interface Price {
  input_eur_per_mtok: number;
  output_eur_per_mtok: number;
}
export interface UsageRow {
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
  user_id: string;
  ok: boolean;
  error_code: string | null;
}

export interface Deps {
  verifyToken(token: string): Promise<{ sub: string; aal?: string } | null>;
  isActiveAdmin(userId: string): Promise<boolean>;
  storeKey(provider: string, key: string, userId: string): Promise<string>;
  deleteKey(provider: string, userId: string): Promise<boolean>;
  getKey(provider: string): Promise<string | null>;
  /** ai_provider + ai_models from system_settings */
  getSettings(): Promise<{ provider: string; models: Record<string, string> }>;
  isFlagOn(key: string): Promise<boolean>;
  getPrice(model: string): Promise<Price | null>;
  getBudget(): Promise<Budget>;
  recordUsage(row: UsageRow): Promise<void>;
  provider(name: string): AiProvider;
  log(message: string): void;
}

/** feature → feature flag (test_connection has no flag: it is the owner's own check) */
export const FEATURE_FLAGS: Record<string, string | null> = {
  test: null,
  catalog_assist: "ai_catalog_assist",
  email_triage: "ai_email_triage",
};

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

/** Refusal with an HTTP status and a code the UI translates. */
export class GatewayError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** One AI call with all checks; `model` = the model chosen for the feature (or the test model). */
export async function runGenerate(
  deps: Deps,
  args: {
    feature: string;
    model: string;
    system: string;
    parts: AiPart[];
    userId: string;
    maxOutputTokens?: number;
  },
): Promise<{ text: string; cost_eur: number; budget: Budget }> {
  const flag = FEATURE_FLAGS[args.feature];
  if (flag === undefined) throw new GatewayError(400, "unknown_feature");
  if (flag && !(await deps.isFlagOn(flag))) throw new GatewayError(403, "feature_off");
  if (!args.model) throw new GatewayError(409, "model_not_chosen");
  const price = await deps.getPrice(args.model);
  if (!price) throw new GatewayError(409, "price_missing");
  const before = await deps.getBudget();
  if (before.state === "blocked") throw new GatewayError(402, "budget_exhausted");
  const { provider } = await deps.getSettings();
  const key = await deps.getKey(provider);
  if (!key) throw new GatewayError(409, "key_missing");

  try {
    const r = await deps.provider(provider).generate({
      apiKey: key,
      model: args.model,
      system: args.system,
      parts: args.parts,
      maxOutputTokens: args.maxOutputTokens ?? 256,
    });
    const cost = costEur(r.inputTokens, r.outputTokens, price);
    await deps.recordUsage({
      feature: args.feature,
      model: args.model,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_eur: cost,
      user_id: args.userId,
      ok: true,
      error_code: null,
    });
    return { text: r.text, cost_eur: cost, budget: await deps.getBudget() };
  } catch (e) {
    if (e instanceof ProviderError) {
      await deps.recordUsage({
        feature: args.feature,
        model: args.model,
        input_tokens: 0,
        output_tokens: 0,
        cost_eur: 0,
        user_id: args.userId,
        ok: false,
        error_code: e.code,
      });
      throw new GatewayError(e.code === "quota" ? 429 : 502, e.code);
    }
    throw e;
  }
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const origin = req.headers.get("Origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: Record<string, unknown>) => {
    deps.log(`ai-gateway ${status}${body.error ? ` ${String(body.error)}` : ""}`);
    return new Response(JSON.stringify(body), { status, headers });
  };

  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(401, { error: "missing_token" });
  const claims = await deps.verifyToken(token).catch(() => null);
  if (!claims?.sub) return reply(401, { error: "invalid_token" });
  if (claims.aal !== "aal2") return reply(403, { error: "aal2_required" });
  if (!(await deps.isActiveAdmin(claims.sub))) return reply(403, { error: "admin_required" });

  let body: { action?: unknown; key?: unknown; feature?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return reply(400, { error: "invalid_body" });
  }

  try {
    const { provider, models } = await deps.getSettings();
    switch (body.action) {
      case "set_key": {
        const key = typeof body.key === "string" ? body.key.trim() : "";
        if (key.length < 20 || key.length > 200 || /\s/.test(key))
          return reply(400, { error: "key_format" });
        const last4 = await deps.storeKey(provider, key, claims.sub);
        return reply(200, { last4 });
      }
      case "delete_key": {
        const removed = await deps.deleteKey(provider, claims.sub);
        return reply(200, { removed });
      }
      case "test_connection": {
        // the model of the chosen purpose (default: the first one that has a model)
        const purpose =
          typeof body.feature === "string" && models[body.feature]
            ? body.feature
            : Object.keys(models).find((k) => models[k]);
        const r = await runGenerate(deps, {
          feature: "test",
          model: purpose ? models[purpose] : "",
          system: "Test spojenia systému Add Value Agency.",
          parts: [{ kind: "instruction", text: "Odpovedz jedným slovom: OK" }],
          userId: claims.sub,
          maxOutputTokens: 16,
        });
        return reply(200, {
          ok: true,
          model: purpose ? models[purpose] : null,
          answer: r.text.slice(0, 40),
          cost_eur: r.cost_eur,
          budget: r.budget,
        });
      }
      default:
        return reply(400, { error: "unknown_action" });
    }
  } catch (e) {
    if (e instanceof GatewayError) return reply(e.status, { error: e.code });
    throw e;
  }
}
