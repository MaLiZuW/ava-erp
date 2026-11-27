"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/core/supabase/client";
import type { Json, Tables } from "@/core/supabase/database.types";
import { throwDb } from "@/core/supabase/errors";

const sb = () => getSupabase();

export type AiModelPrice = Tables<"ai_model_prices">;
export interface AiUsageRow {
  scope: "total" | "feature" | "month";
  key: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
}

/** Purposes of AI in the system (keys of system_settings.ai_models). */
export const AI_PURPOSES = [
  {
    key: "catalog_assist",
    flag: "ai_catalog_assist",
    label: "Asistent katalógu",
    description:
      "Návrh položky alebo kusovníka zo screenshotu či PDF cenníka (F3.5). Človek vždy potvrdzuje.",
  },
  {
    key: "email_triage",
    flag: "ai_email_triage",
    label: "Triáž e-mailov",
    description:
      "Návrh priradenia e-mailu k zákazke a konceptu odpovede (F4.5). Nič sa neodošle samo.",
  },
] as const;

export const FEATURE_LABELS: Record<string, string> = {
  test: "Test spojenia",
  catalog_assist: "Asistent katalógu",
  email_triage: "Triáž e-mailov",
};

/** Codes of the gateway → Slovak messages. */
const GATEWAY_MESSAGES: Record<string, string> = {
  key_format: "Kľúč má nečakaný tvar (20–200 znakov, bez medzier).",
  key_missing: "Najprv uložte API kľúč.",
  model_not_chosen: "Najprv zadajte model aspoň pre jeden účel.",
  price_missing: "Zadajte cenu zvoleného modelu (Ceny modelov) – bez nej poistka nevie počítať.",
  budget_exhausted: "AI je vypnutá – rozpočet je vyčerpaný.",
  invalid_key: "Poskytovateľ kľúč odmietol. Skontrolujte ho v Google AI Studio.",
  model_not_found: "Poskytovateľ model s týmto názvom nepozná.",
  quota: "Poskytovateľ hlási prekročenú kvótu. Skúste to neskôr.",
  provider_error: "Poskytovateľ AI je nedostupný. Skúste to neskôr.",
  aal2_required: "Prihláste sa znova s druhým faktorom.",
  admin_required: "Len administrátor.",
};

/** Calls the Edge Function ai-gateway; errors in plain Slovak. */
async function gateway<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke("ai-gateway", { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    let code = "";
    try {
      code = String(((await res?.clone().json()) as { error?: string })?.error ?? "");
    } catch {
      /* no JSON body */
    }
    if (res?.status === 404 && !code)
      throw new Error(
        "Služba AI ešte nie je nasadená na serveri (DEPLOYMENT.md, Edge Function ai-gateway).",
      );
    throw new Error(GATEWAY_MESSAGES[code] ?? "Požiadavka na AI sa nepodarila. Skúste to znova.");
  }
  return data as T;
}

function useInvalidateAi() {
  const qc = useQueryClient();
  return () => {
    for (const k of [
      ["ai"],
      ["system_settings"],
      ["ai_model_prices"],
      ["activity_logs"],
      ["feature_flags"],
    ])
      void qc.invalidateQueries({ queryKey: k });
  };
}

export function useSetAiKey() {
  const done = useInvalidateAi();
  return useMutation({
    mutationFn: (key: string) => gateway<{ last4: string }>({ action: "set_key", key }),
    onSuccess: done,
  });
}

export function useDeleteAiKey() {
  const done = useInvalidateAi();
  return useMutation({
    mutationFn: () => gateway<{ removed: boolean }>({ action: "delete_key" }),
    onSuccess: done,
  });
}

export function useTestAi() {
  const done = useInvalidateAi();
  return useMutation({
    mutationFn: () =>
      gateway<{ ok: boolean; model: string; answer: string; cost_eur: number }>({
        action: "test_connection",
      }),
    onSettled: done,
  });
}

/** ai_provider, ai_models, ai_budget_limit_eur, ai_budget_cutoff_eur */
export function useAiSettings() {
  return useQuery({
    queryKey: ["system_settings", "ai"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("system_settings")
        .select("key, value")
        .in("key", ["ai_provider", "ai_models", "ai_budget_limit_eur", "ai_budget_cutoff_eur"]);
      if (error) throwDb(error);
      const get = (k: string) => data?.find((r) => r.key === k)?.value;
      return {
        provider: String(get("ai_provider") ?? "gemini"),
        models: (get("ai_models") ?? {}) as Record<string, string>,
        limit: Number(get("ai_budget_limit_eur") ?? 5),
        cutoff: Number(get("ai_budget_cutoff_eur") ?? 4.5),
      };
    },
  });
}

export function useSaveAiSettings() {
  const done = useInvalidateAi();
  return useMutation({
    mutationFn: async (rows: { key: string; value: Json }[]) => {
      for (const r of rows) {
        const { error } = await sb()
          .from("system_settings")
          .update({ value: r.value as NonNullable<Json> })
          .eq("key", r.key);
        if (error)
          throwDb(error, {
            "23514":
              "Hodnota nie je platná: model len písmená, číslice a . _ / -; rozpočet 0–1000 €; hranica vypnutia nesmie byť vyššia ako rozpočet.",
          });
      }
    },
    onSuccess: done,
  });
}

export function useAiModelPrices() {
  return useQuery({
    queryKey: ["ai_model_prices"],
    queryFn: async () => {
      const { data, error } = await sb().from("ai_model_prices").select("*").order("model");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveModelPrice() {
  const done = useInvalidateAi();
  return useMutation({
    mutationFn: async (v: { model: string; input: number; output: number }) => {
      const { error } = await sb()
        .from("ai_model_prices")
        .upsert(
          { model: v.model, input_eur_per_mtok: v.input, output_eur_per_mtok: v.output },
          { onConflict: "model" },
        );
      if (error)
        throwDb(error, { "23514": "Názov modelu: písmená, číslice a . _ / - (bez medzier)." });
    },
    onSuccess: done,
  });
}

export function useDeleteModelPrice() {
  const done = useInvalidateAi();
  return useMutation({
    mutationFn: async (model: string) => {
      const { error } = await sb().from("ai_model_prices").delete().eq("model", model);
      if (error) throwDb(error);
    },
    onSuccess: done,
  });
}

export function useAiUsage() {
  return useQuery({
    queryKey: ["ai", "usage"],
    queryFn: async () => {
      const { data, error } = await sb().from("v_ai_usage_summary").select("*");
      if (error) throwDb(error);
      return (data ?? []).map((r) => ({
        ...r,
        calls: Number(r.calls),
        input_tokens: Number(r.input_tokens),
        output_tokens: Number(r.output_tokens),
        cost_eur: Number(r.cost_eur),
      })) as AiUsageRow[];
    },
  });
}
