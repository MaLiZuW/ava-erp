/**
 * Creates the fictitious price lists for tests of the catalog import (D26) – reproducibly:
 *   npx tsx scripts/make-import-fixtures.ts
 * Data are invented (no real supplier, D22); names start with "E2E " so the e2e cleanup
 * removes anything that stays on the dev project.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import writeExcelFile from "write-excel-file/node";

const DIR = join(process.cwd(), "e2e", "fixtures");

// price list of a fictitious Czech supplier: CZK, prices WITH VAT 21 %, separator ";"
const ROWS = [
  ["Kód", "Názov", "EAN", "MJ", "Cena s DPH"],
  ["E2E-K01", "E2E Importovaný kufrík čierny", "4006381333931", "ks", "1 210,00"],
  ["E2E-K02", "E2E Importovaná taška žltá; veľká", "96385074", "ks", "242,50"],
  ["E2E-K03", "E2E Importovaná šnúrka chybná", "4006381333932", "ks", "12,10"],
];

const csv = (rows: string[][]) =>
  rows
    .map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";"))
    .join("\r\n") + "\r\n";

/** Windows-1250 (Excel CSV on Slovak / Czech Windows) for the characters used above. */
const CP1250: Record<string, number> = {
  á: 0xe1,
  ä: 0xe4,
  č: 0xe8,
  ď: 0xef,
  é: 0xe9,
  ě: 0xec,
  í: 0xed,
  ľ: 0xbe,
  ĺ: 0xe5,
  ň: 0xf2,
  ó: 0xf3,
  ô: 0xf4,
  ŕ: 0xe0,
  ř: 0xf8,
  š: 0x9a,
  ť: 0x9d,
  ú: 0xfa,
  ů: 0xf9,
  ý: 0xfd,
  ž: 0x9e,
  Á: 0xc1,
  Č: 0xc8,
  Ď: 0xcf,
  É: 0xc9,
  Í: 0xcd,
  Ľ: 0xbc,
  Ň: 0xd2,
  Ó: 0xd3,
  Š: 0x8a,
  Ť: 0x8d,
  Ú: 0xda,
  Ý: 0xdd,
  Ž: 0x8e,
};
function encodeCp1250(text: string): Buffer {
  return Buffer.from(
    Array.from(text, (ch) => {
      const code = ch.charCodeAt(0);
      if (code < 0x80) return code;
      const b = CP1250[ch];
      if (b == null) throw new Error(`no Windows-1250 byte for "${ch}"`);
      return b;
    }),
  );
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, "cennik-fiktivny-utf8.csv"), "﻿" + csv(ROWS), "utf8");
  writeFileSync(join(DIR, "cennik-fiktivny-cp1250.csv"), encodeCp1250(csv(ROWS)));
  // XLSX: numbers stay numbers (price, EAN) – as an exported price list would have them
  const sheet = [
    ROWS[0],
    ...ROWS.slice(1).map(([code, name, ean, unit, price]) => [
      code,
      name,
      Number(ean),
      unit,
      Number(price.replace(/\s/g, "").replace(",", ".")),
    ]),
  ];
  await writeExcelFile(sheet).toFile(join(DIR, "cennik-fiktivny.xlsx"));
  console.log(`written 3 files to ${DIR}`);
}

void main();
