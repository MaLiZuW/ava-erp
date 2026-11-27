import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costToEurCents, parseRateMicro } from "@/core/calc/purchase-price";
import { isValidGtin } from "@/core/validation";
import { decodeText, detectDelimiter, parseCsv, readTable } from "./file";
import {
  columnLabels,
  dataRows,
  guessMapping,
  markDuplicates,
  parseEan,
  parsePriceCents,
  toParsedRow,
} from "./rows";

const fixture = (name: string) => readFileSync(join(process.cwd(), "e2e", "fixtures", name));
const units = new Set(["ks", "bal", "m", "kg"]);

describe("CSV", () => {
  it("quotes, doubled quotes, separators and line breaks inside a field", () => {
    const rows = parseCsv('a;"b;c";"d ""x"""\r\n1;"2\n3";4\n\n', ";");
    expect(rows).toEqual([
      ["a", "b;c", 'd "x"'],
      ["1", "2\n3", "4"],
    ]);
  });

  it("detects the separator from the first line (outside quotes)", () => {
    expect(detectDelimiter("a;b;c\n1,2;3")).toBe(";");
    expect(detectDelimiter('"x;y",b,c')).toBe(",");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });

  it("reads UTF-8 and Windows-1250 (Excel) the same", () => {
    const utf = decodeText(new Uint8Array(fixture("cennik-fiktivny-utf8.csv")));
    const cp = decodeText(new Uint8Array(fixture("cennik-fiktivny-cp1250.csv")));
    expect(utf.encoding).toBe("utf-8");
    expect(cp.encoding).toBe("windows-1250");
    expect(parseCsv(cp.text)).toEqual(parseCsv(utf.text));
    expect(parseCsv(cp.text)[2][1]).toBe("E2E Importovaná taška žltá; veľká");
  });
});

describe("XLSX", () => {
  it("reads the first sheet; numbers stay numbers", async () => {
    const buf = fixture("cennik-fiktivny.xlsx");
    const file = Object.assign(new Blob([buf]), { name: "cennik.xlsx" });
    const { rows } = await readTable(file);
    expect(rows[0]).toEqual(["Kód", "Názov", "EAN", "MJ", "Cena s DPH"]);
    expect(rows[1][2]).toBe(4006381333931);
    expect(rows[1][4]).toBe(1210);
  });

  it("refuses a file that is not XLSX", async () => {
    const file = Object.assign(new Blob(["not a zip"]), { name: "x.xlsx" });
    await expect(readTable(file)).rejects.toThrow(/nie je platný XLSX/);
  });
});

describe("price, EAN, rows", () => {
  it("prices as written in price lists → cents, half up", () => {
    expect(parsePriceCents("12,50")).toBe(1250);
    expect(parsePriceCents("1 234,50 €")).toBe(123450);
    expect(parsePriceCents("1.234,50")).toBe(123450);
    expect(parsePriceCents("1,234.50")).toBe(123450);
    expect(parsePriceCents("0,125 Kč")).toBe(13);
    expect(parsePriceCents("0,124")).toBe(12);
    expect(parsePriceCents(2.5)).toBe(250);
    expect(parsePriceCents("-5")).toBeNull();
    expect(parsePriceCents("cena")).toBeNull();
    expect(parsePriceCents("")).toBeNull();
  });

  it("EAN from a number cell keeps all digits", () => {
    expect(parseEan(4006381333931)).toBe("4006381333931");
    expect(parseEan(" 4006 3813 33931 ")).toBe("4006381333931");
    expect(parseEan("")).toBeNull();
  });

  it("guesses the mapping from the header (Slovak, Czech, English)", () => {
    expect(guessMapping(["Kód", "Názov", "EAN", "MJ", "Cena s DPH"])).toMatchObject({
      supplier_item_code: 0,
      name: 1,
      ean: 2,
      unit_code: 3,
      price: 4,
    });
    expect(guessMapping(["SKU", "Name", "Price", "Unit"])).toMatchObject({
      supplier_item_code: 0,
      name: 1,
      price: 2,
      unit_code: 3,
    });
  });

  it("checks each row like the database; duplicates inside the file", () => {
    const sheet = parseCsv(decodeText(new Uint8Array(fixture("cennik-fiktivny-utf8.csv"))).text);
    const mapping = guessMapping(sheet[0]);
    const rows = dataRows(sheet, 2).map((r) => toParsedRow(r.cells, mapping, { units }));
    expect(rows[0]).toEqual({
      parsed: {
        name: "E2E Importovaný kufrík čierny",
        supplier_item_code: "E2E-K01",
        ean: "4006381333931",
        price: "121000",
        unit_code: "ks",
        item_type: "goods",
        description: null,
      },
      errors: [],
    });
    expect(rows[2].errors).toEqual([
      "EAN/GTIN nie je platný (8, 12, 13 alebo 14 číslic s kontrolnou číslicou).",
    ]);
    const bad = toParsedRow(["K-9", "", "", "kartón", "x"], mapping, { units });
    expect(bad.errors).toEqual([
      "Chýba názov.",
      "Chýba cena alebo nie je číslo.",
      "Neznáma jednotka.",
    ]);
    const twice = [rows[0], { parsed: { ...rows[0].parsed }, errors: [] as string[] }];
    markDuplicates(twice);
    expect(twice[1].errors).toEqual([
      "Kód dodávateľa je v súbore viackrát.",
      "EAN je v súbore viackrát.",
    ]);
    expect(columnLabels(sheet, true)[1]).toBe("B – Názov");
    expect(columnLabels(sheet, false)[1]).toBe("Stĺpec B");
  });

  it("item types by their Slovak label; a package is never imported", () => {
    const m = { ...guessMapping(["Názov", "Cena", "Typ"]) };
    expect(toParsedRow(["A", "1", "Externá služba"], m, { units }).parsed.item_type).toBe(
      "external_service",
    );
    expect(toParsedRow(["A", "1", "tovar"], m, { units }).parsed.item_type).toBe("goods");
    expect(toParsedRow(["A", "1", "Balíček"], m, { units }).errors[0]).toMatch(/balíček/);
  });
});

describe("GTIN and purchase price (same cases as pgTAP 13)", () => {
  it("GTIN-8/12/13/14 with check digit", () => {
    for (const ok of ["96385074", "036000291452", "4006381333931", "10012345678902"])
      expect(isValidGtin(ok)).toBe(true);
    for (const bad of ["4006381333932", "400638133393", "123456789", "40063813339A1", ""])
      expect(isValidGtin(bad)).toBe(false);
  });

  it("EUR without VAT, exact cents, half up", () => {
    const czk = parseRateMicro("25")!;
    expect(costToEurCents(100000, { vatPct: 21, rateMicro: czk })).toBe(3306);
    expect(costToEurCents(250)).toBe(250);
    expect(costToEurCents(12300, { vatPct: 23 })).toBe(10000);
    expect(costToEurCents(5, { rateMicro: parseRateMicro("2") })).toBe(3);
    expect(costToEurCents(100000, { rateMicro: parseRateMicro("4,25") })).toBe(23529);
    expect(costToEurCents(121000, { vatPct: 21, rateMicro: czk })).toBe(4000);
    expect(costToEurCents(2500, { vatPct: 21, rateMicro: czk })).toBe(83);
  });

  it("exchange rate: positive, at most 6 decimals", () => {
    expect(parseRateMicro("25,125")).toBe(25_125_000n);
    expect(parseRateMicro("0")).toBeNull();
    expect(parseRateMicro("1,1234567")).toBeNull();
    expect(parseRateMicro("abc")).toBeNull();
  });
});
