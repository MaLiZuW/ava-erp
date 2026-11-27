import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { auditChanges, AuditTimeline, displayValue, type AuditEntry } from "./audit-timeline";

const base: Omit<AuditEntry, "action" | "old_data" | "new_data"> = {
  id: 1,
  table_name: "companies",
  record_id: "c1",
  from_status: null,
  to_status: null,
  note: null,
  actor: "u1",
  at: "2026-11-27T08:05:00Z",
};

describe("auditChanges", () => {
  it("lists only changed fields and ignores audit columns", () => {
    const changes = auditChanges({
      action: "update",
      old_data: { id: "c1", ico: "TODO", city: "Košice", updated_at: "a", updated_by: "x" },
      new_data: { id: "c1", ico: "27082440", city: "Košice", updated_at: "b", updated_by: "y" },
    });
    expect(changes).toEqual([{ field: "ico", from: "TODO", to: "27082440" }]);
  });

  it("shows filled values of a new record", () => {
    const changes = auditChanges({
      action: "insert",
      old_data: null,
      new_data: { email: "a@b.sk", note: null },
    });
    expect(changes).toEqual([{ field: "email", from: "", to: "a@b.sk" }]);
  });

  it("formats booleans, empty values and long values", () => {
    expect(displayValue(true)).toBe("áno");
    expect(displayValue(null)).toBe("—");
    expect(displayValue("x".repeat(200))).toHaveLength(80);
  });
});

describe("AuditTimeline", () => {
  it("shows who, when and what changed", () => {
    render(
      <AuditTimeline
        entries={[
          {
            ...base,
            action: "update",
            old_data: { ico: "TODO" },
            new_data: { ico: "27082440" },
          },
        ]}
        actorName={() => "Vlado"}
        fieldLabel={(_t, f) => (f === "ico" ? "IČO" : f)}
      />,
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("27/11/2026 09:05");
    expect(item).toHaveTextContent("Vlado");
    expect(item).toHaveTextContent("Zmenené");
    expect(item).toHaveTextContent("IČO");
    expect(item).toHaveTextContent("TODO → 27082440");
  });

  it("has an empty state", () => {
    render(<AuditTimeline entries={[]} actorName={() => ""} />);
    expect(screen.getByText("Zatiaľ bez zmien.")).toBeVisible();
  });
});

describe("Slovak format of history values (owner's point 11)", () => {
  it("money, percentages, decimals, dates, booleans and lists", () => {
    expect(displayValue(123456, "default_cost_cents")).toBe("1\u00a0234,56\u00a0€");
    expect(displayValue(12.5, "default_pricing_pct")).toBe("12,5 %");
    expect(displayValue(3.5, "quantity")).toBe("3,5");
    expect(displayValue("2026-01-31", "valid_from")).toBe("31/01/2026");
    expect(displayValue("2026-11-27T08:05:00+00:00", "at")).toBe("27/11/2026 09:05");
    expect(displayValue(false, "is_active")).toBe("nie");
    expect(displayValue(["potlač", "catering"], "categories")).toBe("potlač, catering");
    expect(displayValue([], "categories")).toBe("—");
  });

  it("uses the resolver for references (names instead of UUIDs)", () => {
    const resolve = (field: string, value: unknown) =>
      field === "component_item_id" && value === "11111111-1111-1111-1111-111111111111"
        ? "Hrnček"
        : undefined;
    const changes = auditChanges(
      {
        action: "insert",
        old_data: null,
        new_data: { component_item_id: "11111111-1111-1111-1111-111111111111", quantity: 2 },
      },
      resolve,
    );
    expect(changes).toEqual([
      { field: "component_item_id", from: "", to: "Hrnček" },
      { field: "quantity", from: "", to: "2" },
    ]);
  });
});
