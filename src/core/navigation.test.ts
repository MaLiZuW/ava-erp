import { describe, expect, it } from "vitest";
import { NAV_ITEMS, findNavItem } from "./navigation";

describe("navigation", () => {
  it("has 14 unique items", () => {
    expect(NAV_ITEMS).toHaveLength(14);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(14);
  });
  it("includes Reporty a KPI and Dokumenty", () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(labels).toContain("Reporty a KPI");
    expect(labels).toContain("Dokumenty");
  });
  it("finds items with and without trailing slash", () => {
    expect(findNavItem("/zakazky")?.label).toBe("Zákazky");
    expect(findNavItem("/zakazky/")?.label).toBe("Zákazky");
    expect(findNavItem("/")?.label).toBe("Prehľad");
    expect(findNavItem("/neexistuje/")).toBeUndefined();
  });
});
