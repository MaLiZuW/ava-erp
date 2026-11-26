import { describe, expect, it } from "vitest";
import { HISTORY_FILTERS, isSettingsEntry } from "@/features/settings/history-filters";
import type { AuditEntry } from "@/ui/audit-timeline";
import { auditChanges, displayValue } from "@/ui/audit-timeline";
import { describeAuditEntry, formatBytes, humanFieldValue } from "./audit-describe";

const BLOCK = "11111111-1111-1111-1111-111111111111";
const entry = (p: Partial<AuditEntry>): AuditEntry => ({
  id: 1,
  table_name: "documents",
  record_id: null,
  action: "insert",
  old_data: null,
  new_data: null,
  from_status: null,
  to_status: null,
  note: null,
  actor: "u1",
  at: "2026-11-27T08:00:00Z",
  ...p,
});
const logoDoc = {
  file_name: "logo.png",
  category: "logo",
  mime_type: "image/png",
  size_bytes: 2355,
  sha256: "ab".repeat(32),
  storage_path: "2026/companies/x/y-logo.png",
  entity_table: "companies",
  entity_id: BLOCK,
  version: 1,
};
const contentImage = {
  ...logoDoc,
  file_name: "logo11.png",
  category: "content_image",
  entity_table: "content_blocks",
};
const resolve = (field: string, value: unknown) =>
  field === "entity_id" && value === BLOCK ? "O firme" : undefined;

describe("history as readable sentences (point 22)", () => {
  it("logo and content images", () => {
    expect(describeAuditEntry(entry({ new_data: logoDoc }), resolve)).toBe(
      "Nahraté logo logo.png (2,3 kB)",
    );
    expect(describeAuditEntry(entry({ action: "delete", old_data: contentImage }), resolve)).toBe(
      "Odstránený obrázok logo11.png z bloku O firme",
    );
    expect(describeAuditEntry(entry({ new_data: contentImage }), resolve)).toBe(
      "Nahratý obrázok logo11.png (2,3 kB) do bloku O firme",
    );
    expect(
      describeAuditEntry(
        entry({
          table_name: "companies",
          action: "update",
          old_data: { logo_document_id: null },
          new_data: { logo_document_id: BLOCK },
        }),
        resolve,
      ),
    ).toBe("Zmenené logo firmy");
    expect(
      describeAuditEntry(
        entry({ table_name: "units", new_data: { code: "l" } }),
        resolve,
        () => "Jednotka: l",
      ),
    ).toBe("Vytvorené: Jednotka: l");
  });

  it("technical fields are hidden; size and type are human", () => {
    const fields = auditChanges(entry({ new_data: logoDoc })).map((c) => c.field);
    expect(fields).toEqual(
      expect.arrayContaining(["file_name", "category", "mime_type", "size_bytes"]),
    );
    for (const f of ["sha256", "storage_path", "entity_table", "entity_id", "version"])
      expect(fields).not.toContain(f);
    expect(displayValue(2355, "size_bytes")).toBe("2,3 kB");
    expect(displayValue("image/png", "mime_type")).toBe("PNG obrázok");
    expect(humanFieldValue("category", "content_image")).toBe("obrázok obsahu");
    expect(formatBytes(1_572_864)).toBe("1,5 MB");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("settings sections show only their own entries", () => {
    const logoFilter = HISTORY_FILTERS["/nastavenia/firma/logo/"];
    expect(logoFilter(entry({ new_data: logoDoc }))).toBe(true);
    expect(logoFilter(entry({ action: "delete", old_data: contentImage }))).toBe(false);
    const logoChange = entry({
      table_name: "companies",
      action: "update",
      old_data: { logo_document_id: null, iban: "x" },
      new_data: { logo_document_id: BLOCK, iban: "x" },
    });
    expect(logoFilter(logoChange)).toBe(true);
    expect(HISTORY_FILTERS["/nastavenia/firma/"](logoChange)).toBe(false);
    expect(
      HISTORY_FILTERS["/nastavenia/firma/"](
        entry({
          table_name: "companies",
          action: "update",
          old_data: { iban: "a" },
          new_data: { iban: "b" },
        }),
      ),
    ).toBe(true);
    // the whole settings history: no content images
    expect(isSettingsEntry(entry({ new_data: contentImage }))).toBe(false);
    expect(isSettingsEntry(entry({ table_name: "system_settings", new_data: { key: "x" } }))).toBe(
      true,
    );
  });
});
