"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/core/supabase/client";
import type { Tables } from "@/core/supabase/database.types";
import { throwDb } from "@/core/supabase/errors";
import type { OverheadOutput, TaxBracketOutput } from "./reporting";

const sb = () => getSupabase();

export type OverheadRow = Tables<"overhead_costs">;
export type TaxBracket = Tables<"income_tax_brackets">;
export type CapacityRow = Tables<"capacity_plans">;
export type KpiTarget = Tables<"kpi_targets">;

const done = (qc: ReturnType<typeof useQueryClient>, table: string) => {
  void qc.invalidateQueries({ queryKey: [table] });
  void qc.invalidateQueries({ queryKey: ["activity_logs"] });
};

// --- overhead -------------------------------------------------------------------------------------------
export function useOverhead(month: string) {
  return useQuery({
    queryKey: ["overhead_costs", month],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("overhead_costs")
        .select("*")
        .eq("month", month)
        .order("category");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveOverhead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      month,
      values,
    }: {
      id: string | null;
      month: string;
      values: OverheadOutput;
    }) => {
      const res = id
        ? await sb().from("overhead_costs").update(values).eq("id", id)
        : await sb()
            .from("overhead_costs")
            .insert({ month, ...values });
      if (res.error)
        throwDb(res.error, {
          "23505":
            "Táto kategória už v danom mesiaci a divízii existuje. Upravte existujúci riadok.",
        });
    },
    onSuccess: () => done(qc, "overhead_costs"),
  });
}

export function useDeleteOverhead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("overhead_costs").delete().eq("id", id);
      if (error) throwDb(error);
    },
    onSuccess: () => done(qc, "overhead_costs"),
  });
}

// --- income tax brackets ------------------------------------------------------------------------------------
export function useTaxBrackets() {
  return useQuery({
    queryKey: ["income_tax_brackets"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("income_tax_brackets")
        .select("*")
        .order("valid_from", { ascending: false })
        .order("revenue_from_cents");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveTaxBracket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: TaxBracketOutput }) => {
      const row = { ...values, rate_pct: values.rate_pct! };
      const res = id
        ? await sb().from("income_tax_brackets").update(row).eq("id", id)
        : await sb().from("income_tax_brackets").insert(row);
      if (res.error)
        throwDb(res.error, {
          "23P01": "Pásmo sa prekrýva s iným pásmom platným v rovnakom období.",
        });
    },
    onSuccess: () => done(qc, "income_tax_brackets"),
  });
}

// --- capacity ----------------------------------------------------------------------------------------------
export function useCapacity(month: string) {
  return useQuery({
    queryKey: ["capacity_plans", month],
    queryFn: async () => {
      const { data, error } = await sb().from("capacity_plans").select("*").eq("month", month);
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      month,
      hours,
    }: {
      userId: string;
      month: string;
      hours: number;
    }) => {
      const { error } = await sb()
        .from("capacity_plans")
        .upsert(
          { user_id: userId, month, available_hours: hours },
          { onConflict: "user_id,month" },
        );
      if (error) throwDb(error);
    },
    onSuccess: () => done(qc, "capacity_plans"),
  });
}

// --- KPI targets ----------------------------------------------------------------------------------------------
export function useKpiTargets() {
  return useQuery({
    queryKey: ["kpi_targets"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("kpi_targets")
        .select("*")
        .order("valid_from", { ascending: false });
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveKpiTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      row,
    }: {
      id: string | null;
      row: Omit<KpiTarget, "id" | "created_at" | "created_by" | "updated_at" | "updated_by">;
    }) => {
      const res = id
        ? await sb().from("kpi_targets").update(row).eq("id", id)
        : await sb().from("kpi_targets").insert(row);
      if (res.error)
        throwDb(res.error, {
          "23505": "Cieľ s týmto dátumom platnosti už existuje.",
          "23514": "Hranica upozornenia musí byť na horšej strane cieľa.",
        });
    },
    onSuccess: () => done(qc, "kpi_targets"),
  });
}

export function useDeleteKpiTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("kpi_targets").delete().eq("id", id);
      if (error) throwDb(error);
    },
    onSuccess: () => done(qc, "kpi_targets"),
  });
}

/** Target valid on `day` for one KPI and division (null = Spolu): newest valid_from ≤ day. */
export function currentTarget(
  rows: readonly KpiTarget[],
  key: string,
  divisionId: string | null,
  day: string,
): KpiTarget | undefined {
  return rows
    .filter((r) => r.kpi_key === key && r.division_id === divisionId && r.valid_from <= day)
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];
}
