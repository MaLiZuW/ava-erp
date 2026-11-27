import { z } from "zod";
import { parseRateMicro } from "@/core/calc/purchase-price";
import {
  dateField,
  gtinField,
  moneyField,
  optDateField,
  optMoneyField,
  optPercentField,
  optText,
  positiveDecimalField,
} from "@/core/form-fields";
import type { Database } from "@/core/supabase/database.types";

export type ItemType = Database["public"]["Enums"]["item_type"];
export type PricingMode = Database["public"]["Enums"]["pricing_mode"];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  goods: "Materiál / tovar",
  external_service: "Externá služba",
  labor: "Vlastná práca",
  resource: "Technika a vybavenie",
  package: "Balíček",
  other: "Ostatné",
};

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  none: "Bez navýšenia",
  margin: "Marža %",
  markup: "Prirážka %",
};

export const CATALOG_TABS = [
  { value: "polozky", label: "Položky" },
  { value: "balicky", label: "Balíčky" },
  { value: "jednotky", label: "Jednotky" },
  { value: "sadzby", label: "Roly a sadzby" },
  { value: "technika", label: "Technika a vybavenie" },
  { value: "import", label: "Import" },
] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number]["value"];

// --- catalog item ----------------------------------------------------------------------------------
export const itemSchema = z
  .object({
    code: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || /^[A-Za-z0-9._/-]{1,30}$/.test(v),
        "Kód: písmená bez diakritiky, číslice, . _ / - (max. 30).",
      )
      .transform((v) => (v === "" ? null : v)),
    name: z.string().trim().min(1, "Zadajte názov.").max(200, "Najviac 200 znakov."),
    item_type: z.enum(["goods", "external_service", "labor", "resource", "package", "other"]),
    division_id: z.string().transform((v) => (v === "" ? null : v)),
    unit_code: z.string().min(1, "Vyberte jednotku."),
    // purchase price as on the supplier's price list; the DB computes EUR without VAT (D26)
    cost_original_amount: moneyField("Zadajte nákupnú cenu (0 alebo viac)."),
    cost_currency: z.string().regex(/^[A-Z]{3}$/, "Vyberte menu."),
    cost_includes_vat: z.boolean(),
    cost_vat_rate_pct: optPercentField(100),
    cost_fx_rate: z.string().transform((v, ctx) => {
      if (v.trim() === "") return null;
      const micro = parseRateMicro(v);
      if (micro == null) {
        ctx.addIssue({
          code: "custom",
          message: "Kurz: kladné číslo, najviac 6 desatinných miest.",
        });
        return z.NEVER;
      }
      return Number(micro) / 1_000_000;
    }),
    cost_fx_date: optDateField(),
    supplier_item_code: optText(60),
    ean: gtinField(),
    default_supplier_id: z.string().transform((v) => (v === "" ? null : v)),
    default_pricing_mode: z.enum(["none", "margin", "markup"]),
    default_pricing_pct: optPercentField(),
    description: optText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.cost_includes_vat && v.cost_vat_rate_pct == null) {
      ctx.addIssue({ code: "custom", path: ["cost_vat_rate_pct"], message: "Zadajte sadzbu DPH." });
    }
    if (v.cost_currency !== "EUR" && v.cost_fx_rate == null) {
      ctx.addIssue({
        code: "custom",
        path: ["cost_fx_rate"],
        message: `Zadajte kurz (koľko ${v.cost_currency} je 1 EUR).`,
      });
    }
    if (v.cost_currency !== "EUR" && v.cost_fx_date == null) {
      ctx.addIssue({ code: "custom", path: ["cost_fx_date"], message: "Zadajte dátum kurzu." });
    }
    if (v.default_pricing_mode !== "none" && v.default_pricing_pct == null) {
      ctx.addIssue({
        code: "custom",
        path: ["default_pricing_pct"],
        message: "Zadajte percento navýšenia.",
      });
    }
    if (
      v.default_pricing_mode === "margin" &&
      v.default_pricing_pct != null &&
      v.default_pricing_pct >= 100
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["default_pricing_pct"],
        message: "Marža musí byť menšia ako 100 %.",
      });
    }
  });
export type ItemInput = z.input<typeof itemSchema>;
export type ItemOutput = z.output<typeof itemSchema>;

// --- package component ---------------------------------------------------------------------------------
export const componentSchema = z.object({
  component_item_id: z.string().min(1, "Vyberte položku."),
  quantity: positiveDecimalField(4, "Množstvo musí byť väčšie ako 0 (najviac 4 desatinné miesta)."),
});
export type ComponentInput = z.input<typeof componentSchema>;
export type ComponentOutput = z.output<typeof componentSchema>;

// --- unit ----------------------------------------------------------------------------------------------
export const unitSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9šžčťľýáíéúäôň]{1,10}$/, "Kód: malé písmená a číslice, najviac 10 znakov."),
  name: z.string().trim().min(1, "Zadajte názov.").max(50),
});
export type UnitInput = z.input<typeof unitSchema>;

// --- labour roles and rates ---------------------------------------------------------------------------
export const roleSchema = z.object({
  name: z.string().trim().min(1, "Zadajte názov roly.").max(100),
});
export type RoleInput = z.input<typeof roleSchema>;

export const rateSchema = z
  .object({
    cost_rate_cents: moneyField("Zadajte kalkulačnú sadzbu v eurách za hodinu."),
    bill_rate_cents: moneyField("Zadajte fakturovanú sadzbu v eurách za hodinu."),
    valid_from: dateField(),
    valid_to: optDateField(),
  })
  .superRefine((v, ctx) => {
    if (v.valid_to && v.valid_to < v.valid_from) {
      ctx.addIssue({
        code: "custom",
        path: ["valid_to"],
        message: "Platnosť do nemôže byť pred platnosťou od.",
      });
    }
  });
export type RateInput = z.input<typeof rateSchema>;
export type RateOutput = z.output<typeof rateSchema>;

// --- resources -----------------------------------------------------------------------------------------
export const resourceSchema = z.object({
  name: z.string().trim().min(1, "Zadajte názov.").max(200),
  kind: optText(50),
  purchase_cost_cents: moneyField("Zadajte obstarávaciu cenu v eurách (0 alebo viac)."),
  expected_life_hours: positiveDecimalField(2, "Hodiny životnosti musia byť väčšie ako 0."),
  operating_cost_per_hour_cents: moneyField(
    "Zadajte prevádzkové náklady na hodinu (0 alebo viac).",
  ),
  bill_rate_cents: optMoneyField("Zadajte predajnú sadzbu v eurách za hodinu."),
});
export type ResourceInput = z.input<typeof resourceSchema>;
export type ResourceOutput = z.output<typeof resourceSchema>;

/** Suggested resource kinds (DATABASE_SCHEMA.md §4 examples; free text is allowed). */
export const RESOURCE_KINDS = ["zariadenie", "vozidlo", "technika"];

// --- change history labels --------------------------------------------------------------------------------
export const CATALOG_FIELD_LABELS: Record<string, Record<string, string>> = {
  catalog_items: {
    code: "Kód",
    name: "Názov",
    item_type: "Typ",
    division_id: "Divízia",
    unit_code: "Jednotka",
    default_cost_cents: "Nákupná cena (centy)",
    default_supplier_id: "Dodávateľ",
    default_pricing_mode: "Navýšenie",
    default_pricing_pct: "Navýšenie %",
    description: "Popis",
    is_active: "Aktívna",
    main_photo_document_id: "Hlavná fotka",
    supplier_item_code: "Kód dodávateľa",
    ean: "EAN / GTIN",
    cost_currency: "Mena nákupu",
    cost_original_amount: "Cena v cenníku",
    cost_fx_rate: "Kurz",
    cost_fx_date: "Dátum kurzu",
    cost_includes_vat: "Cena s DPH",
    cost_vat_rate_pct: "Sadzba DPH %",
    cost_source: "Zdroj ceny",
    cost_import_batch_id: "Dávka importu",
  },
  documents: {
    file_name: "Súbor",
    category: "Kategória",
    mime_type: "Typ",
    size_bytes: "Veľkosť",
  },
  package_components: {
    package_item_id: "Balíček",
    component_item_id: "Komponent",
    quantity: "Množstvo",
  },
  units: { code: "Kód", name: "Názov" },
  labor_roles: { name: "Rola", is_active: "Aktívna" },
  labor_rates: {
    role_id: "Rola",
    cost_rate_cents: "Kalkulačná sadzba (centy)",
    bill_rate_cents: "Fakturovaná sadzba (centy)",
    valid_from: "Platí od",
    valid_to: "Platí do",
  },
  resources: {
    name: "Názov",
    kind: "Druh",
    purchase_cost_cents: "Obstarávacia cena (centy)",
    expected_life_hours: "Životnosť (h)",
    operating_cost_per_hour_cents: "Prevádzka (centy/h)",
    cost_rate_cents: "Nákladová sadzba (centy/h)",
    bill_rate_cents: "Predajná sadzba (centy/h)",
    is_active: "Aktívny",
  },
};

export const CATALOG_TABLE_LABELS: Record<string, string> = {
  catalog_items: "Položka",
  package_components: "Kusovník",
  units: "Jednotka",
  labor_roles: "Rola",
  labor_rates: "Sadzba",
  resources: "Technika",
  documents: "Príloha",
  import_batches: "Dávka importu",
  import_templates: "Šablóna importu",
};
