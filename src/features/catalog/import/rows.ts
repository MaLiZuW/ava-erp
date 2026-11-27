/**
 * Rows of a price list → values of catalog items (D26). The same checks run again in the database
 * (public.dry_run_import_batch); here they give an immediate preview with errors per row.
 */
import { isValidGtin } from "@/core/validation";
import { ITEM_TYPE_LABELS, type ItemType } from "../schema";
import type { Cell, Sheet } from "./file";

export const TARGETS = [
  { key: "name", label: "Názov", required: true },
  { key: "supplier_item_code", label: "Kód dodávateľa", required: false },
  { key: "ean", label: "EAN / GTIN", required: false },
  { key: "price", label: "Cena", required: true },
  { key: "unit_code", label: "Jednotka", required: false },
  { key: "item_type", label: "Typ položky", required: false },
  { key: "description", label: "Popis", required: false },
] as const;
export type Target = (typeof TARGETS)[number]["key"];
/** target → column index (0-based); null = not imported */
export type Mapping = Record<Target, number | null>;

export const EMPTY_MAPPING: Mapping = {
  name: null,
  supplier_item_code: null,
  ean: null,
  price: null,
  unit_code: null,
  item_type: null,
  description: null,
};

/** Values sent to import_batch_rows.parsed (price = cents of the batch currency). */
export interface ParsedRow {
  name: string;
  supplier_item_code: string | null;
  ean: string | null;
  price: string | null;
  unit_code: string;
  item_type: ItemType;
  description: string | null;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const HEADER_WORDS: Record<Target, string[]> = {
  name: [
    "nazov",
    "nazov polozky",
    "nazev",
    "name",
    "produkt",
    "tovar",
    "polozka",
    "artikel",
    "nazwa",
  ],
  supplier_item_code: [
    "kod",
    "kod dodavatela",
    "katalogove cislo",
    "kat cislo",
    "cislo",
    "code",
    "sku",
    "art",
    "kod produktu",
    "kod zbozi",
  ],
  ean: ["ean", "gtin", "ciarovy kod", "carovy kod", "barcode", "ean kod"],
  price: [
    "cena",
    "price",
    "nakupna cena",
    "jednotkova cena",
    "cena bez dph",
    "cena s dph",
    "cena za ks",
    "cena mj",
  ],
  unit_code: ["mj", "jednotka", "merna jednotka", "unit", "jedn"],
  item_type: ["typ", "druh", "type"],
  description: ["popis", "description", "poznamka", "opis"],
};

/** Mapping guessed from the header row (the user checks and changes it). */
export function guessMapping(header: readonly Cell[]): Mapping {
  const out: Mapping = { ...EMPTY_MAPPING };
  const used = new Set<number>();
  const cols = header.map((c) => norm(String(c ?? "")));
  for (const t of TARGETS) {
    const words = HEADER_WORDS[t.key];
    let idx = cols.findIndex((c, i) => !used.has(i) && words.includes(c));
    if (idx < 0)
      idx = cols.findIndex(
        (c, i) => !used.has(i) && c !== "" && words.some((w) => c.startsWith(w)),
      );
    if (idx >= 0) {
      out[t.key] = idx;
      used.add(idx);
    }
  }
  return out;
}

const text = (c: Cell | undefined): string => {
  if (c == null) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).trim();
};

/**
 * Price as written in price lists: "12,50", "1 234,50 €", "1.234,50", "12.5", "0,125 Kč" or an
 * XLSX number → cents, rounded half up. null = not a price; negative prices are refused.
 */
export function parsePriceCents(c: Cell | undefined): number | null {
  let s = typeof c === "number" ? String(c) : text(c);
  s = s.replace(/[\s  ]/g, "").replace(/(€|eur|czk|kč|kc|pln|zł|zl)/gi, "");
  if (s === "" || /^-/.test(s)) return null;
  if (typeof c !== "number") {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      // the last separator is the decimal one, the other one groups thousands
      s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    } else s = s.replace(",", ".");
  }
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = (m[2] ?? "").padEnd(3, "0");
  const cents = Number(m[1]) * 100 + Number(frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1 : 0);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** EAN from a cell: digits only (XLSX keeps long numbers as numbers). */
export function parseEan(c: Cell | undefined): string | null {
  if (typeof c === "number") return Number.isInteger(c) ? c.toFixed(0) : String(c);
  const v = text(c).replace(/[\s-]/g, "");
  return v === "" ? null : v;
}

const UNIT_ALIASES: Record<string, string> = {
  kus: "ks",
  "ks.": "ks",
  pcs: "ks",
  pc: "ks",
  szt: "ks",
  balenie: "bal",
  "bal.": "bal",
};

const TYPE_BY_LABEL = new Map<string, ItemType>(
  (Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][]).flatMap(([k, l]) => [
    [norm(l), k],
    [norm(k), k],
  ]),
);
["tovar", "material", "zbozi"].forEach((w) => TYPE_BY_LABEL.set(w, "goods"));
["sluzba", "externa sluzba"].forEach((w) => TYPE_BY_LABEL.set(w, "external_service"));

/** One row → values + errors (Slovak, the same wording as the database). */
export function toParsedRow(
  row: readonly Cell[],
  mapping: Mapping,
  { units }: { units: ReadonlySet<string> },
): { parsed: ParsedRow; errors: string[] } {
  const at = (t: Target) => (mapping[t] == null ? undefined : row[mapping[t]!]);
  const errors: string[] = [];
  const name = text(at("name"));
  if (!name) errors.push("Chýba názov.");
  else if (name.length > 200) errors.push("Názov je dlhší ako 200 znakov.");

  const cents = parsePriceCents(at("price"));
  if (cents == null) errors.push("Chýba cena alebo nie je číslo.");

  const ean = parseEan(at("ean"));
  if (ean && !isValidGtin(ean))
    errors.push("EAN/GTIN nie je platný (8, 12, 13 alebo 14 číslic s kontrolnou číslicou).");

  const code = text(at("supplier_item_code")) || null;
  if (code && code.length > 60) errors.push("Kód dodávateľa je dlhší ako 60 znakov.");

  const rawUnit = text(at("unit_code")).toLowerCase();
  const unit = rawUnit === "" ? "ks" : (UNIT_ALIASES[rawUnit] ?? rawUnit);
  if (!units.has(unit)) errors.push("Neznáma jednotka.");

  const rawType = norm(text(at("item_type")));
  const type = rawType === "" ? "goods" : TYPE_BY_LABEL.get(rawType);
  if (!type || type === "package")
    errors.push("Neznámy typ položky (balíček sa importom nezakladá).");

  return {
    parsed: {
      name,
      supplier_item_code: code,
      ean,
      price: cents == null ? null : String(cents),
      unit_code: unit,
      item_type: type && type !== "package" ? type : "goods",
      description: text(at("description")) || null,
    },
    errors,
  };
}

/** Duplicates inside the file (the database checks them again). */
export function markDuplicates(rows: { parsed: ParsedRow; errors: string[] }[]): void {
  const codes = new Set<string>();
  const eans = new Set<string>();
  for (const r of rows) {
    const c = r.parsed.supplier_item_code?.toLowerCase();
    if (c) {
      if (codes.has(c)) r.errors.push("Kód dodávateľa je v súbore viackrát.");
      codes.add(c);
    }
    const e = r.parsed.ean?.padStart(14, "0");
    if (e) {
      if (eans.has(e)) r.errors.push("EAN je v súbore viackrát.");
      eans.add(e);
    }
  }
}

/** Data rows of the sheet (from the first data row, 1-based). */
export function dataRows(sheet: Sheet, firstDataRow: number): { rowNo: number; cells: Cell[] }[] {
  return sheet
    .slice(Math.max(0, firstDataRow - 1))
    .map((cells, i) => ({ rowNo: firstDataRow + i, cells }));
}

/** Column names for the mapping selects: header text, or A, B, C … */
export function columnLabels(sheet: Sheet, hasHeader: boolean): string[] {
  const width = Math.max(0, ...sheet.slice(0, 50).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => {
    const letter =
      i < 26
        ? String.fromCharCode(65 + i)
        : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`;
    const head = hasHeader ? text(sheet[0]?.[i]) : "";
    return head ? `${letter} – ${head}` : `Stĺpec ${letter}`;
  });
}
