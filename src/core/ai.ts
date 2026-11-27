"use client";

/**
 * AI availability for the whole system (D25): every AI button asks useAiAvailability(feature) and
 * is greyed out when the key is missing, the feature is off or the budget fuse switched AI off.
 * Manual work never depends on AI.
 */
import { useQuery } from "@tanstack/react-query";
import { useFeatureFlag } from "./shared-queries";
import { getSupabase } from "./supabase/client";
import { throwDb } from "./supabase/errors";

export type AiBudgetState = "ok" | "warn50" | "warn90" | "blocked";
export interface AiBudget {
  spent_eur: number;
  limit_eur: number;
  cutoff_eur: number;
  pct: number;
  state: AiBudgetState;
}
export interface AiKeyStatus {
  provider: string;
  is_set: boolean;
  last4: string | null;
  set_at: string | null;
  set_by_name: string | null;
}

export function useAiBudget() {
  return useQuery({
    queryKey: ["ai", "budget"],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("ai_budget_status").single();
      if (error) throwDb(error);
      const b = data as Record<string, unknown>;
      return {
        spent_eur: Number(b.spent_eur),
        limit_eur: Number(b.limit_eur),
        cutoff_eur: Number(b.cutoff_eur),
        pct: Number(b.pct),
        state: String(b.state) as AiBudgetState,
      } satisfies AiBudget;
    },
  });
}

export function useAiKeyStatus() {
  return useQuery({
    queryKey: ["ai", "key"],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("ai_key_status");
      if (error) throwDb(error);
      return ((data ?? []) as AiKeyStatus[])[0] ?? null;
    },
  });
}

export type AiFeature = "ai_catalog_assist" | "ai_email_triage";

export function useAiAvailability(feature: AiFeature) {
  const flag = useFeatureFlag(feature);
  const key = useAiKeyStatus();
  const budget = useAiBudget();
  const reason: string | null = !key.data?.is_set
    ? "AI kľúč nie je nastavený (Nastavenia → AI)."
    : !flag
      ? "Funkcia je v Nastaveniach → AI vypnutá."
      : budget.data?.state === "blocked"
        ? "AI je vypnutá – vyčerpaný rozpočet. Ručná práca funguje ďalej."
        : null;
  return {
    loading: key.isPending || budget.isPending,
    available: !key.isPending && !budget.isPending && reason === null,
    reason,
    budget: budget.data ?? null,
  };
}
