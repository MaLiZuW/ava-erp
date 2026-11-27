"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/core/supabase/client";
import type { Tables } from "@/core/supabase/database.types";
import { throwDb } from "@/core/supabase/errors";
import type { OverheadOutput, TaxBracketOutput } from "./reporting";

const sb = () => getSupabase();

export type OverheadRow = Tables<"overhead_costs">;
export type TaxBracket = Tables<"income_tax_brackets">;
export type KpiTarget = Tables<"kpi_targets">;

const done = (qc: ReturnType<typeof useQueryClient>, table: string) => {
  void qc.invalidateQueries({ queryKey: ["overhead_monthly"] });
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

// --- capacity calendar (block H, D24) ---------------------------------------------------------------
export type WorkPattern = Tables<"work_patterns">;
export type CalendarException = Tables<"calendar_exceptions">;
export type CapacityDay = {
  day: string;
  pattern_hours: number;
  holiday_name: string | null;
  is_day_off: boolean;
  is_absent: boolean;
  other_work: number;
  extra: number;
  available_hours: number;
};

const CAPACITY_KEYS = ["work_patterns", "calendar_exceptions", "resource_capacity"];
const capacityDone = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of CAPACITY_KEYS) void qc.invalidateQueries({ queryKey: [k] });
  void qc.invalidateQueries({ queryKey: ["activity_logs"] });
};

/** People whose capacity is planned (resources of kind "user"). */
export function useUserResources() {
  return useQuery({
    queryKey: ["bookable_resources", "user"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("v_bookable_resources")
        .select("id, display_name")
        .eq("kind", "user")
        .eq("is_active", true)
        .order("display_name");
      if (error) throwDb(error);
      return (data ?? []) as { id: string; display_name: string | null }[];
    },
  });
}

export function useWorkPatterns(resourceId: string | null) {
  return useQuery({
    queryKey: ["work_patterns", resourceId],
    enabled: !!resourceId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("work_patterns")
        .select("*")
        .eq("resource_id", resourceId!)
        .order("valid_from", { ascending: false });
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSavePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      resourceId: string;
      validFrom: string;
      hours: Record<string, number>;
    }) => {
      const { error } = await sb().rpc("revise_work_pattern", {
        p_resource_id: v.resourceId,
        p_valid_from: v.validFrom,
        p_mon: v.hours.mon,
        p_tue: v.hours.tue,
        p_wed: v.hours.wed,
        p_thu: v.hours.thu,
        p_fri: v.hours.fri,
        p_sat: v.hours.sat,
        p_sun: v.hours.sun,
      });
      if (error)
        throwDb(error, { "23P01": "Vzor sa prekrýva s inou verziou. Zvoľte iný dátum platnosti." });
    },
    onSuccess: () => capacityDone(qc),
  });
}

/** Daily capacity computed by the database (pattern − days of rest ± exceptions). */
export function useCapacityRange(resourceId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ["resource_capacity", resourceId, from, to],
    enabled: !!resourceId,
    queryFn: async () => {
      const { data, error } = await sb().rpc("resource_capacity", {
        p_resource_id: resourceId!,
        p_from: from,
        p_to: to,
      });
      if (error) throwDb(error);
      return (data ?? []).map((d) => ({
        ...d,
        available_hours: Number(d.available_hours),
        pattern_hours: Number(d.pattern_hours),
        other_work: Number(d.other_work),
        extra: Number(d.extra),
      })) as CapacityDay[];
    },
  });
}

export function useExceptions(resourceId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ["calendar_exceptions", resourceId, from, to],
    enabled: !!resourceId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("calendar_exceptions")
        .select("*")
        .eq("resource_id", resourceId!)
        .lte("date_from", to)
        .gte("date_to", from)
        .order("date_from");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      resource_id: string;
      date_from: string;
      date_to: string;
      kind: string;
      hours: number | null;
      note: string | null;
    }) => {
      const { error } = await sb().from("calendar_exceptions").insert(v);
      if (error) throwDb(error);
    },
    onSuccess: () => capacityDone(qc),
  });
}

export function useDeleteException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("calendar_exceptions").delete().eq("id", id);
      if (error) throwDb(error);
    },
    onSuccess: () => capacityDone(qc),
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

// --- recurring overhead (block I) ------------------------------------------------------------------
export type RecurringOverhead = Tables<"recurring_overheads">;
export type OverheadMonthRow = {
  month: string;
  division_id: string | null;
  category: string;
  source: "recurring" | "one_off";
  amount_cents: number;
  original_amount_cents: number;
  frequency: string | null;
  recurring_id: string | null;
  overhead_cost_id: string | null;
};

const recurringDone = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ["recurring_overheads", "overhead_monthly", "data_reviews", "activity_logs"])
    void qc.invalidateQueries({ queryKey: [k] });
};

export function useRecurringOverheads() {
  return useQuery({
    queryKey: ["recurring_overheads"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("recurring_overheads")
        .select("*")
        .order("category")
        .order("valid_from", { ascending: false });
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

const RECURRING_MESSAGES = {
  "23P01":
    "Tento náklad (kategória a divízia) už v danom období platí. Zmeňte sumu cez „Zmeniť sumu od…“.",
  "23514":
    "Zmenu treba zadať ako novú verziu od 1. dňa mesiaca v rámci platnosti – minulé mesiace sa neprepisujú.",
};

export function useAddRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      category: string;
      division_id: string | null;
      amount_cents: number;
      frequency: string;
      valid_from: string;
      note: string | null;
    }) => {
      const { error } = await sb().from("recurring_overheads").insert(v);
      if (error) throwDb(error, RECURRING_MESSAGES);
    },
    onSuccess: () => recurringDone(qc),
  });
}

export function useReviseRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      amount_cents: number;
      effective_from: string;
      frequency?: string;
    }) => {
      const { error } = await sb().rpc("revise_recurring_overhead", {
        p_id: v.id,
        p_amount_cents: v.amount_cents,
        p_effective_from: v.effective_from,
        p_frequency: v.frequency,
      });
      if (error) throwDb(error, RECURRING_MESSAGES);
    },
    onSuccess: () => recurringDone(qc),
  });
}

/** "Ukončiť k…": the last month the cost applies (its last day). */
export function useEndRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; valid_to: string }) => {
      const { error } = await sb()
        .from("recurring_overheads")
        .update({ valid_to: v.valid_to })
        .eq("id", v.id);
      if (error) throwDb(error, RECURRING_MESSAGES);
    },
    onSuccess: () => recurringDone(qc),
  });
}

/** One month: recurring shares + one-off items (v_overhead_monthly). */
export function useOverheadMonthly(month: string) {
  return useQuery({
    queryKey: ["overhead_monthly", month],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("v_overhead_monthly")
        .select("*")
        .eq("month", month)
        .order("category");
      if (error) throwDb(error);
      return (data ?? []) as OverheadMonthRow[];
    },
  });
}
