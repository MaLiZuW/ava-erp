import { describe, expect, it } from "vitest";
import { overheadMonthShare } from "./overhead-share";

// The same cases are asserted in the database (supabase/tests/11_overhead_reviews.test.sql).
describe("overheadMonthShare", () => {
  it("yearly 1 000,00 € → 12 months add up exactly", () => {
    const months = Array.from(
      { length: 12 },
      (_, i) => `2026-${String(i + 1).padStart(2, "0")}-01`,
    );
    const shares = months.map((m) => overheadMonthShare(100000, "yearly", "2026-01-01", m));
    expect(shares.reduce((s, x) => s + x, 0)).toBe(100000);
    expect(shares[0]).toBe(8334);
    expect(shares[11]).toBe(8333);
  });

  it("quarterly and monthly", () => {
    const q = ["2026-04-01", "2026-05-01", "2026-06-01"].map((m) =>
      overheadMonthShare(1000, "quarterly", "2026-04-01", m),
    );
    expect(q).toEqual([334, 333, 333]);
    expect(overheadMonthShare(45000, "monthly", "2026-01-01", "2026-05-01")).toBe(45000);
    // the period repeats: the 4th month starts a new quarter
    expect(overheadMonthShare(1000, "quarterly", "2026-04-01", "2026-07-01")).toBe(334);
  });
});
