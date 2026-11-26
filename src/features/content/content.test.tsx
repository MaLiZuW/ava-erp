import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ContentBlockTile } from "./components/content-block-tile";
import { blockSchema, CONTENT_SLOTS } from "./schema";

vi.mock("@/core/supabase/client", () => ({
  getSupabase: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order"]) b[m] = () => b;
      b.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      return b;
    },
  }),
}));

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);

describe("content slots", () => {
  it("have unique keys matching the database check and the job types of chapter 2", () => {
    const keys = CONTENT_SLOTS.map((s) => s.key);
    expect(keys).toHaveLength(9);
    expect(new Set(keys).size).toBe(keys.length);
    // company-wide blocks for the presentation (phase 3 addition)
    for (const k of ["about_company", "why_us", "how_we_work", "contact"]) {
      const slot = CONTENT_SLOTS.find((s) => s.key === k);
      expect(slot).toMatchObject({ division: null, jobType: null });
      expect(slot?.flag).toBeUndefined();
    }
    for (const k of keys) expect(k).toMatch(/^[a-z][a-zA-Z0-9_]{1,59}$/);
    expect(CONTENT_SLOTS.find((s) => s.jobType === "ENG")?.division).toBe("AVENG");
    for (const jt of ["EVENT", "PROMO", "SEASON"] as const) {
      expect(CONTENT_SLOTS.find((s) => s.jobType === jt)?.division).toBe("AGENCY");
    }
    // SERVICE stays hidden behind the feature flag
    expect(CONTENT_SLOTS.find((s) => s.jobType === "SERVICE")?.flag).toBe("service_cnc");
  });

  it("blockSchema requires a title", () => {
    expect(blockSchema.safeParse({ title: " ", body: "" }).success).toBe(false);
    expect(blockSchema.safeParse({ title: "O firme", body: "Text" }).success).toBe(true);
  });
});

describe("ContentBlockTile", () => {
  it("before the first save: images are disabled and the slot is marked as empty", () => {
    render(wrap(<ContentBlockTile slot={CONTENT_SLOTS[0]} block={null} divisionId={null} />));
    expect(screen.getByText("Zatiaľ nevyplnené")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pridať obrázok" })).toBeDisabled();
    expect(screen.getByLabelText("Nadpis")).toHaveValue("O firme");
  });

  it("shows the version of a saved block", () => {
    const block = {
      id: "11111111-1111-1111-1111-111111111111",
      key: "about_company",
      title: "O nás",
      body: "Text",
      version: 3,
      image_document_ids: [],
      updated_at: "2026-11-26T10:00:00Z",
    } as never;
    render(wrap(<ContentBlockTile slot={CONTENT_SLOTS[0]} block={block} divisionId={null} />));
    expect(screen.getByText("Verzia 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pridať obrázok" })).toBeEnabled();
  });
});
