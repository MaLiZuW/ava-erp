/**
 * Reading a price list (D26): CSV (UTF-8 or Windows-1250, separator ; , or tab, quotes) and XLSX
 * (first sheet, read in the browser – nothing is sent anywhere before the dry run).
 */
import { readSheet } from "read-excel-file/universal";

export type Cell = string | number | boolean | Date | null;
export type Sheet = Cell[][];
export type Encoding = "auto" | "utf-8" | "windows-1250";
export type Delimiter = "auto" | ";" | "," | "\t";

export const MAX_ROWS = 5000;

/** UTF-8 when the bytes are valid UTF-8, otherwise Windows-1250 (Excel "CSV" on Slovak Windows). */
export function decodeText(
  bytes: Uint8Array,
  encoding: Encoding = "auto",
): { text: string; encoding: Exclude<Encoding, "auto"> } {
  let enc: Exclude<Encoding, "auto"> = encoding === "auto" ? "utf-8" : encoding;
  let text: string;
  try {
    text = new TextDecoder(enc, { fatal: encoding === "auto" }).decode(bytes);
  } catch {
    enc = "windows-1250";
    text = new TextDecoder(enc).decode(bytes);
  }
  return { text: text.replace(/^﻿/, ""), encoding: enc };
}

/** Separator used most often outside quotes in the first line. */
export function detectDelimiter(text: string): Exclude<Delimiter, "auto"> {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const best = (Object.entries(counts) as [Exclude<Delimiter, "auto">, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  return best[1] > 0 ? best[0] : ";";
}

/** RFC 4180 CSV: quoted fields with separators, line breaks and doubled quotes. */
export function parseCsv(text: string, delimiter: Delimiter = "auto"): string[][] {
  const sep = delimiter === "auto" ? detectDelimiter(text) : delimiter;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // empty lines are left out
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export const isXlsx = (name: string) => /\.xlsx$/i.test(name);
export const isCsv = (name: string) => /\.(csv|txt)$/i.test(name);

/** Reads the file into a table; CSV options apply to CSV only. */
export async function readTable(
  file: Blob & { name: string },
  { encoding = "auto", delimiter = "auto" }: { encoding?: Encoding; delimiter?: Delimiter } = {},
): Promise<{
  rows: Sheet;
  encoding?: Exclude<Encoding, "auto">;
  delimiter?: Exclude<Delimiter, "auto">;
}> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (isXlsx(file.name)) {
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) throw new Error("Súbor nie je platný XLSX.");
    try {
      const rows = (await readSheet(buf.buffer)) as Sheet;
      return { rows: rows.filter((r) => r.some((c) => c != null && String(c).trim() !== "")) };
    } catch {
      throw new Error("XLSX sa nepodarilo prečítať. Uložte ho v Exceli znova alebo ako CSV.");
    }
  }
  if (!isCsv(file.name)) throw new Error("Podporované sú súbory XLSX a CSV.");
  const { text, encoding: enc } = decodeText(buf, encoding);
  const sep = delimiter === "auto" ? detectDelimiter(text) : delimiter;
  return { rows: parseCsv(text, sep), encoding: enc, delimiter: sep };
}
