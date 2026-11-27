import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OverheadTile } from "@/features/settings/components/reporting/overhead-tile";
import {
  dueOnly,
  REVIEW_HREFS,
  ReviewControl,
  reviewState,
  ReviewsList,
  type ReviewRow,
} from "./data-review";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

// data per table for the mocked Supabase client
const tables: Record<string, unknown[]> = {};
const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@/core/supabase/client", () => ({
  getSupabase: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in"]) b[m] = () => b;
      b.then = (resolve: (v: unknown) => void) => resolve({ data: tables[t] ?? [], error: null });
      return b;
    },
    rpc,
  }),
}));

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
);

const row = (over: Partial<ReviewRow>): ReviewRow => ({
  entity_table: "recurring_overheads",
  entity_id: "11111111-1111-1111-1111-111111111111",
  label: "Opakovaná réžia",
  record_name: "Nájom",
  next_review_at: inDays(100),
  last_reviewed_at: null,
  state: "ok",
  ...over,
});

describe("reviewState (same rule as v_reviews_due)", () => {
  it("past date = overdue, within 30 days = due soon, later = ok", () => {
    expect(reviewState(inDays(-1))).toBe("overdue");
    expect(reviewState(inDays(0))).toBe("due_soon");
    expect(reviewState(inDays(30))).toBe("due_soon");
    expect(reviewState(inDays(31))).toBe("ok");
  });
});

describe("dueOnly", () => {
  it("keeps due records, overdue first, then by date", () => {
    const rows = [
      row({ entity_id: "a", state: "due_soon", next_review_at: inDays(5) }),
      row({ entity_id: "b", state: "ok" }),
      row({ entity_id: "c", state: "overdue", next_review_at: inDays(-3) }),
      row({ entity_id: "d", state: "due_soon", next_review_at: inDays(2) }),
    ];
    expect(dueOnly(rows).map((r) => r.entity_id)).toEqual(["c", "d", "a"]);
  });
});

describe("REVIEW_HREFS", () => {
  it("has a place to edit every reviewed table of the migration", () => {
    for (const t of [
      "recurring_overheads",
      "labor_rates",
      "resources",
      "income_tax_brackets",
      "work_patterns",
      "companies",
    ])
      expect(REVIEW_HREFS[t]).toMatch(/^\//);
  });
});

describe("ReviewsList / ReviewControl", () => {
  it("shows the state in words and confirms without change", async () => {
    render(
      wrap(
        <ReviewsList
          rows={[row({ state: "overdue", next_review_at: "2026-01-31", record_name: "Poistenie" })]}
        />,
      ),
    );
    expect(screen.getByText("Po termíne (31/01/2026)")).toBeInTheDocument();
    // next/link drops the trailing slash in tests (trailingSlash is applied by the build)
    expect(screen.getByRole("link", { name: "Upraviť →" }).getAttribute("href")).toMatch(
      /^\/nastavenia\/reporting\/rezia\/?$/,
    );
    await userEvent.click(screen.getByRole("button", { name: "Potvrdiť bez zmeny – Poistenie" }));
    expect(rpc).toHaveBeenCalledWith("confirm_data_review", {
      p_entity_table: "recurring_overheads",
      p_entity_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("ReviewControl is silent while the review is not due", async () => {
    tables.data_reviews = [{ entity_id: "x", next_review_at: inDays(200), last_reviewed_at: null }];
    const { container } = render(wrap(<ReviewControl entityTable="labor_rates" entityId="x" />));
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it("ReviewControl shows 'Overiť do' when due soon", async () => {
    tables.data_reviews = [{ entity_id: "y", next_review_at: inDays(10), last_reviewed_at: null }];
    render(wrap(<ReviewControl entityTable="resources" entityId="y" />));
    expect(await screen.findByText(/^Overiť do \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Potvrdiť bez zmeny" })).toBeInTheDocument();
  });
});

describe("OverheadTile", () => {
  it("switches between recurring and one-off; the month view marks recurring rows", async () => {
    tables.recurring_overheads = [];
    tables.v_overhead_monthly = [
      {
        month: "2026-11-01",
        division_id: null,
        category: "Poistenie",
        source: "recurring",
        amount_cents: 10000,
        original_amount_cents: 120000,
        frequency: "yearly",
        recurring_id: "r1",
        overhead_cost_id: null,
      },
      {
        month: "2026-11-01",
        division_id: null,
        category: "Oprava tlačiarne",
        source: "one_off",
        amount_cents: 2500,
        original_amount_cents: 2500,
        frequency: null,
        recurring_id: null,
        overhead_cost_id: "o1",
      },
    ];
    tables.overhead_costs = [
      {
        id: "o1",
        month: "2026-11-01",
        category: "Oprava tlačiarne",
        division_id: null,
        amount_cents: 2500,
        note: null,
      },
    ];
    render(wrap(<OverheadTile />));
    expect(screen.getByRole("button", { name: "Opakované" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("Zatiaľ žiadny opakovaný náklad")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Jednorazové" }));
    expect(await screen.findByText("Opakovaný · ročne")).toBeInTheDocument();
    expect(screen.getByText("podiel zo sumy 1 200,00 €")).toBeInTheDocument();
    expect(screen.getByTestId("overhead-total")).toHaveTextContent("125,00 €");
    expect(screen.getByRole("button", { name: "Zmazať Oprava tlačiarne" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Upraviť v Opakovaných" }));
    expect(screen.getByRole("button", { name: "Opakované" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
