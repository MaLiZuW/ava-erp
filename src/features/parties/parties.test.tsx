import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { searchTerm } from "./api";
import { ContactsTile } from "./components/contacts-tile";
import { PartyForm } from "./components/party-form";
import {
  CONTACT_PRIVACY_NOTE,
  contactSchema,
  FOREIGN_SUPPLIER_WARNING,
  partySchema,
  type PartyInput,
} from "./schema";

// --- Supabase stub: records inserts/updates, answers selects with an empty list -----------------
const calls: { table: string; op: string; values?: unknown }[] = [];
function builder(table: string) {
  const result = { data: [] as unknown[], error: null };
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "filter", "order", "limit", "like", "or", "in"]) b[m] = chain;
  b.insert = (values: unknown) => {
    calls.push({ table, op: "insert", values });
    return b;
  };
  b.update = (values: unknown) => {
    calls.push({ table, op: "update", values });
    return b;
  };
  b.single = async () => ({
    data: { id: "11111111-1111-1111-1111-111111111111", ...(calls.at(-1)?.values as object) },
    error: null,
  });
  b.maybeSingle = async () => ({ data: null, error: null });
  b.then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}
vi.mock("@/core/supabase/client", () => ({ getSupabase: () => ({ from: builder }) }));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

const base: PartyInput = {
  kind: "company",
  name: "Test s.r.o.",
  ico: "",
  dic: "",
  ic_dph: "",
  vat_payer: false,
  street: "",
  city: "",
  zip: "",
  country: "SK",
  billing_email: "",
  payment_terms_days: "",
  note: "",
  categories: "",
};

describe("partySchema", () => {
  it("normalises empty fields to null and IČO without spaces", () => {
    const v = partySchema.parse({
      ...base,
      ico: "357 634 69",
      zip: "81101",
      payment_terms_days: "14",
    });
    expect(v.ico).toBe("35763469");
    expect(v.zip).toBe("811 01");
    expect(v.payment_terms_days).toBe(14);
    expect(v.dic).toBeNull();
    expect(v.billing_email).toBeNull();
  });

  it("refuses an invalid IČO, DIČ, e-mail and payment terms", () => {
    const r = partySchema.safeParse({
      ...base,
      ico: "12345678",
      dic: "123",
      billing_email: "x@",
      payment_terms_days: "-1",
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["ico", "dic", "billing_email", "payment_terms_days"]),
    );
  });

  it("checks the post code format only for SK/CZ", () => {
    expect(partySchema.safeParse({ ...base, zip: "ABC" }).success).toBe(false);
    expect(partySchema.safeParse({ ...base, country: "DE", zip: "80331" }).success).toBe(true);
    expect(partySchema.safeParse({ ...base, country: "GB", zip: "SW1A 1AA" }).success).toBe(true);
  });

  it("accepts EU VAT ids and upper-cases the country", () => {
    const v = partySchema.parse({ ...base, country: "cz", ic_dph: "cz 12345678" });
    expect(v.country).toBe("CZ");
    expect(v.ic_dph).toBe("CZ12345678");
  });

  it("splits categories, removes duplicates and blanks", () => {
    expect(
      partySchema.parse({ ...base, categories: "potlač, catering,, potlač " }).categories,
    ).toEqual(["potlač", "catering"]);
  });
});

describe("contactSchema", () => {
  it("requires a name and validates e-mail / phone", () => {
    expect(
      contactSchema.safeParse({
        full_name: "",
        position: "",
        email: "",
        phone: "",
        is_primary: false,
      }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({
        full_name: "Info",
        position: "",
        email: "INFO@Firma.sk",
        phone: "+421 2 123 456",
        is_primary: true,
      }).data?.email,
    ).toBe("info@firma.sk");
    expect(
      contactSchema.safeParse({
        full_name: "Info",
        position: "",
        email: "",
        phone: "abc",
        is_primary: false,
      }).success,
    ).toBe(false);
  });
});

describe("searchTerm", () => {
  it("removes characters with a meaning in PostgREST filters", () => {
    expect(searchTerm("a,b)(c%_*")).toBe("a b c");
    expect(searchTerm("  Firma  s.r.o. ")).toBe("Firma s r o");
  });
});

describe("PartyForm", () => {
  it("shows an error for an invalid IČO and does not save", async () => {
    calls.length = 0;
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(wrap(<PartyForm kind="customers" party={null} onSaved={onSaved} />));
    await user.type(screen.getByLabelText("Názov / meno"), "Firma s.r.o.");
    await user.type(screen.getByLabelText("IČO"), "12345678");
    await user.click(screen.getByRole("button", { name: "Uložiť" }));
    expect(await screen.findByText(/IČO nie je platné/)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("saves a valid customer without the supplier-only categories", async () => {
    calls.length = 0;
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(wrap(<PartyForm kind="customers" party={null} onSaved={onSaved} />));
    expect(screen.queryByLabelText("Kategórie")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Názov / meno"), "Firma s.r.o.");
    await user.type(screen.getByLabelText("IČO"), "35763469");
    await user.click(screen.getByRole("button", { name: "Uložiť" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0]).toMatchObject({ table: "customers", op: "insert" });
    expect(calls[0].values).not.toHaveProperty("categories");
    expect(calls[0].values).toMatchObject({ name: "Firma s.r.o.", ico: "35763469", country: "SK" });
  });

  it("warns about a foreign supplier as soon as the country is not SK", async () => {
    const user = userEvent.setup();
    render(wrap(<PartyForm kind="suppliers" party={null} onSaved={vi.fn()} />));
    expect(screen.queryByTestId("foreign-supplier-warning")).not.toBeInTheDocument();
    const country = screen.getByLabelText("Krajina");
    await user.clear(country);
    await user.type(country, "DE");
    expect(await screen.findByTestId("foreign-supplier-warning")).toHaveTextContent(
      FOREIGN_SUPPLIER_WARNING,
    );
  });
});

describe("ContactsTile", () => {
  it("shows the personal-data note on the contact form", async () => {
    const user = userEvent.setup();
    render(wrap(<ContactsTile kind="customers" partyId="11111111-1111-1111-1111-111111111111" />));
    await user.click(screen.getByRole("button", { name: "Pridať kontakt" }));
    expect(screen.getByTestId("contact-privacy-note")).toHaveTextContent(CONTACT_PRIVACY_NOTE);
    expect(CONTACT_PRIVACY_NOTE).toMatch(/osobné údaje/);
    expect(CONTACT_PRIVACY_NOTE).toMatch(/plnenia zmluvy/);
  });
});
