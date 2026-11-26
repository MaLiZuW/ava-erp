import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LaborRate, PackageComponent } from "./api";
import { packageCostCents } from "./components/packages-tab";
import { currentRate } from "./components/rates-tab";
import { ResourcesTab } from "./components/resources-tab";
import { itemSchema, rateSchema, resourceSchema, type ItemInput } from "./schema";

vi.mock("@/core/supabase/client", () => ({
  getSupabase: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in"]) b[m] = () => b;
      b.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      return b;
    },
  }),
}));

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
);

const item: ItemInput = {
  code: "",
  name: "Hrnček",
  item_type: "goods",
  division_id: "",
  unit_code: "ks",
  default_cost_cents: "2,50",
  default_supplier_id: "",
  default_pricing_mode: "none",
  default_pricing_pct: "",
  description: "",
};

describe("itemSchema", () => {
  it("stores the cost in cents and empty selects as null", () => {
    const v = itemSchema.parse(item);
    expect(v.default_cost_cents).toBe(250);
    expect(v.division_id).toBeNull();
    expect(v.default_supplier_id).toBeNull();
    expect(v.code).toBeNull();
  });

  it("requires a percentage for margin / markup and keeps margin below 100 %", () => {
    expect(itemSchema.safeParse({ ...item, default_pricing_mode: "markup" }).success).toBe(false);
    expect(
      itemSchema.safeParse({ ...item, default_pricing_mode: "margin", default_pricing_pct: "100" })
        .success,
    ).toBe(false);
    expect(
      itemSchema.parse({ ...item, default_pricing_mode: "margin", default_pricing_pct: "25,5" })
        .default_pricing_pct,
    ).toBe(25.5);
    // markup may exceed 100 %
    expect(
      itemSchema.safeParse({ ...item, default_pricing_mode: "markup", default_pricing_pct: "150" })
        .success,
    ).toBe(true);
  });

  it("refuses a negative cost and an invalid code", () => {
    expect(itemSchema.safeParse({ ...item, default_cost_cents: "-1" }).success).toBe(false);
    expect(itemSchema.safeParse({ ...item, code: "kód s medzerou" }).success).toBe(false);
  });
});

describe("rateSchema", () => {
  it("converts euros and dates; valid_to must not precede valid_from", () => {
    const v = rateSchema.parse({
      cost_rate_cents: "40",
      bill_rate_cents: "60,50",
      valid_from: "01/01/2027",
      valid_to: "",
    });
    expect(v).toEqual({
      cost_rate_cents: 4000,
      bill_rate_cents: 6050,
      valid_from: "2027-01-01",
      valid_to: null,
    });
    expect(
      rateSchema.safeParse({
        cost_rate_cents: "40",
        bill_rate_cents: "60",
        valid_from: "01/02/2027",
        valid_to: "31/01/2027",
      }).success,
    ).toBe(false);
  });
});

describe("resourceSchema", () => {
  it("requires life hours > 0", () => {
    const base = {
      name: "Plotter",
      kind: "",
      purchase_cost_cents: "10 000",
      operating_cost_per_hour_cents: "1,50",
      bill_rate_cents: "",
    };
    expect(resourceSchema.safeParse({ ...base, expected_life_hours: "0" }).success).toBe(false);
    expect(resourceSchema.parse({ ...base, expected_life_hours: "3 000" })).toMatchObject({
      purchase_cost_cents: 1_000_000,
      expected_life_hours: 3000,
      operating_cost_per_hour_cents: 150,
      bill_rate_cents: null,
    });
  });
});

describe("packageCostCents", () => {
  it("sums component cost × quantity, each line rounded to cents", () => {
    const rows = [
      { quantity: 2, component: { default_cost_cents: 250 } },
      { quantity: 0.5, component: { default_cost_cents: 125 } }, // 62.5 → 63
    ] as unknown as PackageComponent[];
    expect(packageCostCents(rows)).toBe(563);
    expect(packageCostCents([])).toBe(0);
  });
});

describe("currentRate", () => {
  const r = (id: string, from: string, to: string | null) =>
    ({ id, valid_from: from, valid_to: to }) as LaborRate;
  it("finds the rate valid on a day (inclusive ends, open end)", () => {
    const rates = [r("new", "2027-01-01", null), r("old", "2026-01-01", "2026-12-31")];
    expect(currentRate(rates, "2026-12-31")?.id).toBe("old");
    expect(currentRate(rates, "2027-01-01")?.id).toBe("new");
    expect(currentRate(rates, "2025-06-01")).toBeUndefined();
  });
});

describe("ResourcesTab", () => {
  it("previews the cost rate with the database formula while typing", async () => {
    const user = userEvent.setup();
    render(wrap(<ResourcesTab />));
    await user.click(screen.getByRole("button", { name: "+ Nový zdroj" }));
    const purchase = screen.getByLabelText("Obstarávacia cena");
    await user.clear(purchase);
    await user.type(purchase, "10 000");
    await user.type(screen.getByLabelText("Predpokladaná životnosť"), "3000");
    const operating = screen.getByLabelText("Prevádzkové náklady / h");
    await user.clear(operating);
    await user.type(operating, "1,50");
    expect(screen.getByTestId("resource-rate-preview")).toHaveTextContent("4,83 €");
  });
});
