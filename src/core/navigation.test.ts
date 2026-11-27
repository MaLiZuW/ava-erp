import { describe, expect, it } from "vitest";
import { NAV_ITEMS, findNavItem, visibleNavItems } from "./navigation";

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
  it("hides Nastavenia from users without the admin role", () => {
    expect(visibleNavItems(["admin"])).toHaveLength(14);
    expect(visibleNavItems(["manager"]).map((i) => i.href)).not.toContain("/nastavenia/");
    expect(visibleNavItems([])).toHaveLength(13);
  });
  it("finds items with and without trailing slash", () => {
    expect(findNavItem("/zakazky")?.label).toBe("Zákazky");
    expect(findNavItem("/zakazky/")?.label).toBe("Zákazky");
    expect(findNavItem("/")?.label).toBe("Prehľad");
    expect(findNavItem("/neexistuje/")).toBeUndefined();
  });
  it("maps sub-pages to their section", () => {
    expect(findNavItem("/zakaznici/detail/")?.label).toBe("Zákazníci");
    expect(findNavItem("/dodavatelia/detail")?.label).toBe("Dodávatelia");
    expect(findNavItem("/zakaznicix/")).toBeUndefined();
  });
});

describe("settings sections (owner's point 20)", () => {
  it("every page has a unique address under /nastavenia/ and belongs to one group", async () => {
    const { SETTINGS_GROUPS, SETTINGS_PAGES, findSettingsPage, findNavItem } =
      await import("./navigation");
    const hrefs = SETTINGS_PAGES.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h).toMatch(/^\/nastavenia\/[a-z0-9/-]+\/$/);
    expect(SETTINGS_GROUPS.map((g) => g.label)).toEqual([
      "Firma",
      "Bezpečnosť",
      "Systém",
      "AI",
      "Reporting",
      "Dáta",
      "História zmien",
    ]);
    expect(findSettingsPage("/nastavenia/reporting/kapacity")?.label).toBe("Kapacity");
    // sub-pages belong to "Nastavenia" in the main menu
    expect(findNavItem("/nastavenia/firma/logo/")?.label).toBe("Nastavenia");
  });

  it("field names are searchable (Ctrl+K)", async () => {
    const { SETTINGS_PAGES } = await import("./navigation");
    const find = (word: string) => SETTINGS_PAGES.find((p) => p.keywords.includes(word))?.href;
    expect(find("IBAN")).toBe("/nastavenia/firma/");
    expect(find("logo")).toBe("/nastavenia/firma/logo/");
    expect(find("dovolenka")).toBe("/nastavenia/reporting/kapacity/");
  });
});
