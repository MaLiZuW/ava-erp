import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/ui/audit-timeline";
import { collectRefs, DELETED_RECORD, makeResolver, refTable } from "./audit-refs";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const D = "33333333-3333-3333-3333-333333333333";

const entry = (data: Record<string, unknown>): AuditEntry => ({
  id: 1,
  table_name: "package_components",
  record_id: null,
  action: "insert",
  old_data: null,
  new_data: data,
  from_status: null,
  to_status: null,
  note: null,
  actor: null,
  at: "2026-11-27T08:00:00Z",
});

describe("audit references – one configuration for the whole system", () => {
  it("knows which table a field points to", () => {
    expect(refTable("component_item_id", {})).toBe("catalog_items");
    expect(refTable("default_supplier_id", {})).toBe("suppliers");
    expect(refTable("logo_document_id", {})).toBe("documents");
    expect(refTable("image_document_ids", {})).toBe("documents");
    expect(refTable("entity_id", { entity_table: "customers" })).toBe("customers");
    expect(refTable("entity_id", { entity_table: "unknown" })).toBeUndefined();
    expect(refTable("name", {})).toBeUndefined();
  });

  it("collects ids per table, also from arrays", () => {
    const refs = collectRefs([
      entry({ package_item_id: A, component_item_id: B }),
      entry({ image_document_ids: [D], name: "x" }),
    ]);
    expect([...refs.get("catalog_items")!].sort()).toEqual([A, B]);
    expect([...refs.get("documents")!]).toEqual([D]);
  });

  it("resolves names; a missing record is shown as deleted", () => {
    const resolve = makeResolver(new Map([["catalog_items", new Map([[A, "Balíček"]])]]));
    expect(resolve("package_item_id", A, {})).toBe("Balíček");
    expect(resolve("component_item_id", B, {})).toBe(DELETED_RECORD);
    expect(resolve("quantity", 2, {})).toBeUndefined();
    // names not loaded yet → raw value for a moment
    expect(makeResolver(undefined)("package_item_id", A, {})).toBeUndefined();
  });
});
