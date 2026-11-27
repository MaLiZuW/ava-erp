import { describe, expect, it } from "vitest";
import { formatKpiValue } from "./components/reporting/kpi-targets-tile";
import {
  KPI_DEFINITIONS,
  kpiTargetSchema,
  monthOptions,
  overheadSchema,
  taxBracketSchema,
} from "./reporting";
import { currentTarget, type KpiTarget } from "./reporting-api";

describe("KPI definitions", () => {
  it("cover the 11 process KPIs of BUSINESS_PROCESSES.md chapter 14 with unique keys", () => {
    expect(KPI_DEFINITIONS).toHaveLength(11);
    expect(new Set(KPI_DEFINITIONS.map((k) => k.key)).size).toBe(11);
    for (const k of KPI_DEFINITIONS) expect(k.key).toMatch(/^[a-z][a-z0-9_]{1,59}$/);
  });
});

describe("kpiTargetSchema", () => {
  it("parses days and percentages; €/h is stored in cents", () => {
    expect(
      kpiTargetSchema("days").parse({
        target_value: "3",
        warning_value: "5",
        direction: "lower_better",
        valid_from: "01/01/2027",
      }),
    ).toEqual({
      target_value: 3,
      warning_value: 5,
      direction: "lower_better",
      valid_from: "2027-01-01",
    });
    expect(
      kpiTargetSchema("money_per_hour").parse({
        target_value: "45",
        warning_value: "",
        direction: "higher_better",
        valid_from: "01/01/2027",
      }).target_value,
    ).toBe(4500);
  });

  it("puts the warning threshold on the worse side of the target", () => {
    const pct = kpiTargetSchema("pct");
    expect(
      pct.safeParse({
        target_value: "40",
        warning_value: "50",
        direction: "higher_better",
        valid_from: "01/01/2027",
      }).success,
    ).toBe(false);
    expect(
      pct.safeParse({
        target_value: "40",
        warning_value: "30",
        direction: "higher_better",
        valid_from: "01/01/2027",
      }).success,
    ).toBe(true);
    expect(
      pct.safeParse({
        target_value: "101",
        warning_value: "",
        direction: "higher_better",
        valid_from: "01/01/2027",
      }).success,
    ).toBe(false);
    expect(
      pct.safeParse({
        target_value: "",
        warning_value: "",
        direction: "higher_better",
        valid_from: "01/01/2027",
      }).success,
    ).toBe(false);
  });
});

describe("overheadSchema / taxBracketSchema", () => {
  it("overhead: amount in cents, shared division = null", () => {
    expect(
      overheadSchema.parse({ category: "Nájom", division_id: "", amount_cents: "450", note: "" }),
    ).toEqual({
      category: "Nájom",
      division_id: null,
      amount_cents: 45000,
      note: null,
    });
    expect(
      overheadSchema.safeParse({ category: "", division_id: "", amount_cents: "-1", note: "" })
        .success,
    ).toBe(false);
  });

  it("tax bracket: rate required, ranges and dates must be ordered", () => {
    const base = {
      valid_from: "01/01/2027",
      valid_to: "",
      revenue_from_cents: "0",
      revenue_to_cents: "",
      rate_pct: "10",
      source_note: "",
    };
    expect(taxBracketSchema.parse(base)).toMatchObject({
      revenue_from_cents: 0,
      revenue_to_cents: null,
      rate_pct: 10,
    });
    expect(taxBracketSchema.safeParse({ ...base, rate_pct: "" }).success).toBe(false);
    expect(taxBracketSchema.safeParse({ ...base, rate_pct: "101" }).success).toBe(false);
    expect(
      taxBracketSchema.safeParse({ ...base, revenue_from_cents: "100", revenue_to_cents: "100" })
        .success,
    ).toBe(false);
    expect(taxBracketSchema.safeParse({ ...base, valid_to: "31/12/2026" }).success).toBe(false);
  });
});

describe("currentTarget", () => {
  const t = (id: string, division: string | null, from: string) =>
    ({ id, kpi_key: "dso_days", division_id: division, valid_from: from }) as KpiTarget;
  it("picks the newest target valid on the day, per division", () => {
    const rows = [
      t("old", null, "2026-01-01"),
      t("new", null, "2027-01-01"),
      t("aveng", "d1", "2026-01-01"),
    ];
    expect(currentTarget(rows, "dso_days", null, "2026-12-31")?.id).toBe("old");
    expect(currentTarget(rows, "dso_days", null, "2027-01-01")?.id).toBe("new");
    expect(currentTarget(rows, "dso_days", "d1", "2027-06-01")?.id).toBe("aveng");
    expect(currentTarget(rows, "dso_days", null, "2025-01-01")).toBeUndefined();
  });
});

describe("monthOptions / formatKpiValue", () => {
  it("lists 25 months with the current one in the middle, labelled MM/YYYY", () => {
    const opts = monthOptions(new Date(2026, 10, 26));
    expect(opts).toHaveLength(25);
    expect(opts[12]).toEqual({ value: "2026-11-01", label: "11/2026" });
    expect(opts[0].value).toBe("2025-11-01");
  });

  it("formats KPI values by unit", () => {
    const byKey = (k: string) => KPI_DEFINITIONS.find((d) => d.key === k)!;
    expect(formatKpiValue(byKey("dso_days"), 30)).toBe("30 dní");
    expect(formatKpiValue(byKey("quote_success_pct"), 42.5)).toBe("42,5 %");
    expect(formatKpiValue(byKey("realized_rate"), 4500)).toBe("45,00 €/h");
    expect(formatKpiValue(byKey("dso_days"), null)).toBe("—");
  });
});
