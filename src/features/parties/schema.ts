import { z } from "zod";
import {
  countryField,
  dicField,
  emailField,
  FIVE_DIGIT_ZIP_COUNTRIES,
  icDphField,
  icoField,
  isFiveDigitZip,
  optInt,
  optText,
  phoneField,
  ZIP_MESSAGE,
  zipField,
} from "@/core/form-fields";

/** Customers and suppliers share one shape (DATABASE_SCHEMA.md §4); the module works with both. */
export type PartyKind = "customers" | "suppliers";

export const PARTY_TEXT: Record<
  PartyKind,
  {
    one: string;
    many: string;
    newLabel: string;
    href: string;
    contactsTable: "customer_contacts" | "supplier_contacts";
    fk: "customer_id" | "supplier_id";
  }
> = {
  customers: {
    one: "Zákazník",
    many: "Zákazníci",
    newLabel: "Nový zákazník",
    href: "/zakaznici/",
    contactsTable: "customer_contacts",
    fk: "customer_id",
  },
  suppliers: {
    one: "Dodávateľ",
    many: "Dodávatelia",
    newLabel: "Nový dodávateľ",
    href: "/dodavatelia/",
    contactsTable: "supplier_contacts",
    fk: "supplier_id",
  },
};

/** Comma-separated categories ("potlač, catering") → unique trimmed list. */
const categoriesField = () =>
  z
    .string()
    .transform((v) =>
      Array.from(
        new Set(
          v
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        ),
      ).slice(0, 20),
    )
    .refine((list) => list.every((c) => c.length <= 40), "Kategória môže mať najviac 40 znakov.");

export const partySchema = z
  .object({
    kind: z.enum(["company", "person"]),
    name: z.string().trim().min(1, "Zadajte názov.").max(200, "Najviac 200 znakov."),
    ico: icoField(),
    dic: dicField(),
    ic_dph: icDphField(),
    vat_payer: z.boolean(),
    street: optText(200),
    city: optText(100),
    zip: zipField(false),
    country: countryField(),
    billing_email: emailField(),
    payment_terms_days: optInt(0, 365, "Splatnosť je 0–365 dní."),
    note: optText(4000),
    categories: categoriesField(),
  })
  .superRefine((v, ctx) => {
    if (v.zip && FIVE_DIGIT_ZIP_COUNTRIES.includes(v.country) && !isFiveDigitZip(v.zip)) {
      ctx.addIssue({ code: "custom", path: ["zip"], message: ZIP_MESSAGE });
    }
  });
export type PartyInput = z.input<typeof partySchema>;
export type PartyOutput = z.output<typeof partySchema>;

export const contactSchema = z.object({
  full_name: z.string().trim().min(1, "Zadajte meno alebo označenie.").max(200),
  position: optText(100),
  email: emailField(),
  phone: phoneField(),
  is_primary: z.boolean(),
});
export type ContactInput = z.input<typeof contactSchema>;
export type ContactOutput = z.output<typeof contactSchema>;

export const machineSchema = z.object({
  manufacturer: optText(100),
  model: optText(100),
  serial_number: optText(100),
  year_built: optInt(1900, 2100, "Rok výroby je 1900–2100."),
  control_system: optText(100),
  location: optText(200),
  note: optText(4000),
});
export type MachineInput = z.input<typeof machineSchema>;
export type MachineOutput = z.output<typeof machineSchema>;

/** GDPR note shown on every contact form (D22; the full information duty follows in phase 8). */
export const CONTACT_PRIVACY_NOTE =
  "Meno, e-mail a telefón kontaktnej osoby sú osobné údaje. Spracúvame ich na účely plnenia zmluvy. Podrobnosti doplníme vo fáze 8.";

/** Foreign supplier warning (BUSINESS_PROCESSES.md 4.9; open question O4). */
export { FOREIGN_SUPPLIER_WARNING } from "@/core/foreign-supplier-notice";

export const PARTY_FIELD_LABELS: Record<string, string> = {
  kind: "Typ",
  name: "Názov",
  ico: "IČO",
  dic: "DIČ",
  ic_dph: "IČ DPH",
  vat_payer: "Platiteľ DPH",
  street: "Ulica a číslo",
  city: "Mesto",
  zip: "PSČ",
  country: "Krajina",
  is_foreign: "Zahraničný",
  categories: "Kategórie",
  billing_email: "Fakturačný e-mail",
  peppol_id: "Peppol ID",
  payment_terms_days: "Splatnosť (dni)",
  note: "Poznámka",
  is_active: "Aktívny",
};

export const CONTACT_FIELD_LABELS: Record<string, string> = {
  full_name: "Meno",
  position: "Pozícia",
  email: "E-mail",
  phone: "Telefón",
  is_primary: "Hlavný kontakt",
  is_active: "Aktívny",
  customer_id: "Zákazník",
  supplier_id: "Dodávateľ",
};

export const MACHINE_FIELD_LABELS: Record<string, string> = {
  manufacturer: "Výrobca",
  model: "Model",
  serial_number: "Výrobné číslo",
  year_built: "Rok výroby",
  control_system: "Riadiaci systém",
  location: "Umiestnenie",
  note: "Poznámka",
  is_active: "Aktívny",
};

/** change history of attachments (D23) */
export const ATTACHMENT_FIELD_LABELS: Record<string, string> = {
  file_name: "Súbor",
  category: "Kategória",
  mime_type: "Typ",
  size_bytes: "Veľkosť",
};
