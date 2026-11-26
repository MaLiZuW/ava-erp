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
