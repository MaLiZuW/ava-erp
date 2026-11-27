import { z } from "zod";
import {
  countryField,
  dicField,
  emailField,
  icoField,
  optChecked,
  optText,
  phoneField,
  webField,
  zipField,
} from "@/core/form-fields";
import { compact, formatIban, isValidIban, isValidSwift } from "@/core/validation";
import { IDLE_MAX_MINUTES, IDLE_MIN_MINUTES } from "@/core/auth/idle";
import { REPORTING_FIELD_LABELS } from "./reporting";

/** Company form (companies, 1 row). vat_payer / ic_dph: the company is NOT a VAT payer (D2). */
export const companySchema = z.object({
  legal_name: z.string().trim().min(1, "Zadajte obchodné meno.").max(200),
  brand_name: z.string().trim().min(1, "Zadajte značku.").max(200),
  ico: icoField(),
  dic: dicField(),
  // optional and normally empty – the company is not a VAT payer
  ic_dph: optChecked(
    (v) => /^SK\d{10}$/.test(compact(v).toUpperCase()),
    "IČ DPH má tvar SK + 10 číslic.",
    (v) => compact(v).toUpperCase(),
  ),
  street: optText(200),
  city: optText(100),
  zip: zipField(true),
  country: countryField(),
  registry_entry: optText(300),
  iban: optChecked(isValidIban, "IBAN nie je platný.", formatIban),
  bank_name: optText(100),
  swift: optChecked(isValidSwift, "SWIFT/BIC má 8 alebo 11 znakov.", (v) =>
    compact(v).toUpperCase(),
  ),
  email: emailField(),
  phone: phoneField(),
  web: webField(),
});
export type CompanyInput = z.input<typeof companySchema>;
export type CompanyOutput = z.output<typeof companySchema>;

export const COMPANY_FIELDS: {
  name: keyof CompanyInput;
  label: string;
  hint?: string;
  wide?: boolean;
}[] = [
  { name: "legal_name", label: "Obchodné meno", wide: true },
  { name: "brand_name", label: "Značka" },
  { name: "ico", label: "IČO" },
  { name: "dic", label: "DIČ" },
  { name: "ic_dph", label: "IČ DPH", hint: "Nevypĺňa sa – firma nie je platiteľ DPH." },
  { name: "street", label: "Ulica a číslo", wide: true },
  { name: "city", label: "Mesto" },
  { name: "zip", label: "PSČ" },
  { name: "country", label: "Krajina" },
  {
    name: "registry_entry",
    label: "Zápis v obchodnom registri",
    hint: "Napr. OR OS Bratislava I, oddiel Sro, vložka č. …",
    wide: true,
  },
  { name: "iban", label: "IBAN", wide: true },
  { name: "bank_name", label: "Banka" },
  { name: "swift", label: "SWIFT / BIC" },
  { name: "email", label: "E-mail" },
  { name: "phone", label: "Telefón" },
  { name: "web", label: "Web" },
];

/** Typed system settings shown in the UI (key → definition). */
export const SYSTEM_SETTINGS = {
  inactivity_minutes: {
    label: "Odhlásenie po nečinnosti (minúty)",
    hint: `${IDLE_MIN_MINUTES}–${IDLE_MAX_MINUTES} minút. Predvolené 30.`,
    schema: z.coerce
      .number({ error: "Zadajte číslo." })
      .int("Zadajte celé číslo.")
      .min(IDLE_MIN_MINUTES, `Najmenej ${IDLE_MIN_MINUTES} minút.`)
      .max(IDLE_MAX_MINUTES, `Najviac ${IDLE_MAX_MINUTES} minút.`),
  },
} as const;
export type SystemSettingKey = keyof typeof SYSTEM_SETTINGS;

export const recipientSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Zadajte e-mail.")
    .pipe(z.email("Zadajte platný e-mail.")),
});
export type RecipientInput = z.input<typeof recipientSchema>;

/** Slovak field names for the change history. */
export const FIELD_LABELS: Record<string, Record<string, string>> = {
  companies: {
    ...Object.fromEntries(COMPANY_FIELDS.map((f) => [f.name, f.label])),
    vat_payer: "Platiteľ DPH",
    logo_document_id: "Logo",
  },
  system_settings: { key: "Nastavenie", value: "Hodnota", description: "Popis" },
  feature_flags: { key: "Funkcia", enabled: "Zapnuté", note: "Popis" },
  notification_recipients: { email: "E-mail", event_types: "Udalosti", is_active: "Aktívny" },
  documents: {
    file_name: "Súbor",
    category: "Druh",
    mime_type: "Typ",
    size_bytes: "Veľkosť",
  },
  user_roles: { user_id: "Používateľ", role: "Rola" },
  profiles: { full_name: "Meno", email: "E-mail", phone: "Telefón", is_active: "Aktívny" },
  "auth.mfa_factors": { target_user: "Používateľ", factors_removed: "Odstránené faktory" },
  ...REPORTING_FIELD_LABELS,
};

export const TABLE_LABELS: Record<string, string> = {
  companies: "Firma",
  system_settings: "Systémové nastavenia",
  feature_flags: "Funkcie",
  notification_recipients: "Notifikácie",
  documents: "Dokumenty",
  user_roles: "Roly",
  profiles: "Profily",
  "auth.mfa_factors": "2FA",
  overhead_costs: "Réžia – jednorazová",
  recurring_overheads: "Réžia – opakovaná",
  data_reviews: "Overenie dát",
  income_tax_brackets: "Daň z príjmov",
  work_patterns: "Kapacity – vzor",
  calendar_exceptions: "Kapacity – výnimka",
  kpi_targets: "Ciele KPI",
};
