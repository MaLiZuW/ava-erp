import { describe, expect, it } from "vitest";
import { resourceCostRateCents } from "./resource-rate";

// The same cases are asserted against the database in supabase/tests/08_catalog.test.sql.
describe("resourceCostRateCents", () => {
  it.each([
    [1_000_000, 3000, 150, 483], // 333,33 → 333 + 150
    [5, 2, 0, 3], // 2.5 → 3 (half up)
    [5, 0.4, 0, 13], // 12.5 → 13
    [0, 100, 250, 250], // rented resource: only operating cost
    [100, 3, 0, 33], // 33.33 → 33
    [200, 3, 0, 67], // 66.67 → 67
    [1, 0.01, 0, 100],
  ])("%i ct / %f h + %i ct/h = %i ct/h", (purchase, hours, operating, expected) => {
    expect(resourceCostRateCents(purchase, hours, operating)).toBe(expected);
  });

  it("returns null for invalid input (life hours 0, negative or fractional cents)", () => {
    expect(resourceCostRateCents(100, 0, 0)).toBeNull();
    expect(resourceCostRateCents(100, -5, 0)).toBeNull();
    expect(resourceCostRateCents(-1, 10, 0)).toBeNull();
    expect(resourceCostRateCents(10.5, 10, 0)).toBeNull();
    expect(resourceCostRateCents(100, Number.NaN, 0)).toBeNull();
  });

  it("stays exact for large amounts", () => {
    // 1 000 000,00 € over 7 hours
    expect(resourceCostRateCents(100_000_000, 7, 0)).toBe(14_285_714);
  });
});
