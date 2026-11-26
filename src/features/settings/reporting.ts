import { z } from "zod";
import {
  dateField,
  moneyField,
  optDateField,
  optMoneyField,
  optPercentField,
  optText,
} from "@/core/form-fields";
import { parseDecimal } from "@/core/format";

/**
 * Process KPIs – BUSINESS_PROCESSES.md chapter 14 (11 indicators). Keys are fixed in code;
 * target values are entered by the owner. `direction` is the default for the form
 * ("lower is better" for durations and complaint rates, "higher is better" for success rates).
 */
export type KpiUnit = "days" | "pct" | "money_per_hour";
export interface KpiDefinition {
  key: string;
  label: string;
  unit: KpiUnit;
  direction: "higher_better" | "lower_better";
  link?: string;
}

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    key: "inquiry_to_quote_days",
    label: "Doba dopyt → CP",
    unit: "days",
    direction: "lower_better",
    link: "S3",
  },
  { key: "quote_success_pct", label: "Úspešnosť CP", unit: "pct", direction: "higher_better" },
  {
    key: "order_to_delivery_days",
    label: "Doba objednávka → dodanie",
    unit: "days",
    direction: "lower_better",
  },
  { key: "on_time_delivery_pct", label: "Dodanie včas", unit: "pct", direction: "higher_better" },
  {
    key: "delivery_to_invoice_days",
    label: "Doba dodanie → faktúra",
    unit: "days",
    direction: "lower_better",
  },
  { key: "dso_days", label: "DSO (dni inkasa)", unit: "days", direction: "lower_better" },
  {
    key: "jobs_below_plan_pct",
    label: "Zákazky pod plánovaným ziskom",
    unit: "pct",
    direction: "lower_better",
  },
  {
    key: "utilization_pct",
    label: "Utilizácia",
    unit: "pct",
    direction: "higher_better",
    link: "S1",
  },
  {
    key: "realized_rate",
    label: "Realizovaná sadzba",
    unit: "money_per_hour",
    direction: "higher_better",
    link: "S2",
  },
  {
    key: "complaint_rate_pct",
    label: "Miera reklamácií",
    unit: "pct",
    direction: "lower_better",
    link: "S5",
  },
  {
    key: "repeat_customers_pct",
    label: "Opakované nákupy",
    unit: "pct",
    direction: "higher_better",
    link: "S7",
  },
];

export const UNIT_SUFFIX: Record<KpiUnit, string> = {
  days: "dní",
  pct: "%",
  money_per_hour: "€/h",
};

export const DIRECTION_LABELS = {
  higher_better: "Vyššie je lepšie",
  lower_better: "Nižšie je lepšie",
} as const;

/** Value of a KPI in the form: days and % as decimals, €/h stored as cents (money rule). */
function kpiValue(unit: KpiUnit, required: boolean) {
  return z.string().transform((v, ctx) => {
    if (v.trim() === "") {
      if (required) ctx.addIssue({ code: "custom", message: "Zadajte hodnotu." });
      return required ? z.NEVER : null;
    }
    if (unit === "money_per_hour") {
      const r = (required ? moneyField() : optMoneyField()).safeParse(v);
      if (!r.success) {
        ctx.addIssue({ code: "custom", message: "Zadajte sumu v eurách, napr. 45,00." });
        return z.NEVER;
      }
      return r.data;
    }
    const n = parseDecimal(v, 2);
    if (n == null || (unit === "pct" && n > 100)) {
      ctx.addIssue({
        code: "custom",
        message: unit === "pct" ? "Zadajte percentá 0–100." : "Zadajte počet dní (0 alebo viac).",
      });
      return z.NEVER;
    }
    return n;
  });
}

export function kpiTargetSchema(unit: KpiUnit) {
  return z
    .object({
      target_value: kpiValue(unit, true),
      warning_value: kpiValue(unit, false),
      direction: z.enum(["higher_better", "lower_better"]),
      valid_from: dateField(),
    })
    .superRefine((v, ctx) => {
      if (v.warning_value == null || v.target_value == null) return;
      const ok =
        v.direction === "higher_better"
          ? v.warning_value <= v.target_value
          : v.warning_value >= v.target_value;
      if (!ok) {
        ctx.addIssue({
          code: "custom",
          path: ["warning_value"],
          message:
            v.direction === "higher_better"
              ? "Hranica upozornenia musí byť nižšia alebo rovná cieľu."
              : "Hranica upozornenia musí byť vyššia alebo rovná cieľu.",
        });
      }
    });
}
export type KpiTargetInput = {
  target_value: string;
  warning_value: string;
  direction: "higher_better" | "lower_better";
  valid_from: string;
};

// --- overhead ----------------------------------------------------------------------------------------
export const overheadSchema = z.object({
  category: z.string().trim().min(1, "Zadajte kategóriu (napr. nájom).").max(100),
  division_id: z.string().transform((v) => (v === "" ? null : v)),
  amount_cents: moneyField("Zadajte sumu v eurách (0 alebo viac)."),
  note: optText(1000),
});
export type OverheadInput = z.input<typeof overheadSchema>;
export type OverheadOutput = z.output<typeof overheadSchema>;

// --- income tax brackets -------------------------------------------------------------------------------
export const taxBracketSchema = z
  .object({
    valid_from: dateField(),
    valid_to: optDateField(),
    revenue_from_cents: moneyField("Zadajte dolnú hranicu výnosov v eurách."),
    revenue_to_cents: optMoneyField("Zadajte hornú hranicu výnosov v eurách."),
    rate_pct: optPercentField(100),
    source_note: optText(500),
  })
  .superRefine((v, ctx) => {
    if (v.rate_pct == null)
      ctx.addIssue({ code: "custom", path: ["rate_pct"], message: "Zadajte sadzbu dane." });
    if (v.valid_to && v.valid_to < v.valid_from)
      ctx.addIssue({
        code: "custom",
        path: ["valid_to"],
        message: "Platnosť do nemôže byť pred platnosťou od.",
      });
    if (v.revenue_to_cents != null && v.revenue_to_cents <= v.revenue_from_cents)
      ctx.addIssue({
        code: "custom",
        path: ["revenue_to_cents"],
        message: "Horná hranica musí byť vyššia ako dolná.",
      });
  });
export type TaxBracketInput = z.input<typeof taxBracketSchema>;
export type TaxBracketOutput = z.output<typeof taxBracketSchema>;

// --- months ----------------------------------------------------------------------------------------------
/** First day of a month as ISO date ("2026-11-01"). */
export function monthIso(year: number, month1: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-01`;
}

/** Months around today for month pickers: 12 back, 12 ahead (newest last). */
export function monthOptions(today = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = -12; i <= 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const value = monthIso(d.getFullYear(), d.getMonth() + 1);
    out.push({ value, label: `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` });
  }
  return out;
}

export const REPORTING_FIELD_LABELS: Record<string, Record<string, string>> = {
  overhead_costs: {
    month: "Mesiac",
    division_id: "Divízia",
    category: "Kategória",
    amount_cents: "Suma (centy)",
    note: "Poznámka",
  },
  income_tax_brackets: {
    valid_from: "Platí od",
    valid_to: "Platí do",
    revenue_from_cents: "Výnosy od (centy)",
    revenue_to_cents: "Výnosy do (centy)",
    rate_pct: "Sadzba %",
    source_note: "Zdroj",
  },
  capacity_plans: { user_id: "Používateľ", month: "Mesiac", available_hours: "Dostupné hodiny" },
  kpi_targets: {
    kpi_key: "KPI",
    division_id: "Divízia",
    target_value: "Cieľ",
    warning_value: "Upozornenie",
    direction: "Smer",
    valid_from: "Platí od",
  },
};

export const REPORTING_TABLES = [
  "overhead_costs",
  "income_tax_brackets",
  "capacity_plans",
  "kpi_targets",
] as const;
