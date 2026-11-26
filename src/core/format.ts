/**
 * Shared formatting utilities. Money is ALWAYS integer cents (never float) – see CLAUDE.md.
 */

const NBSP = " ";
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Formats a date as DD/MM/YYYY. Date-only strings (YYYY-MM-DD) are not shifted by time zone. */
export function formatDate(input: Date | string | null | undefined): string {
  if (input == null || input === "") return "";
  let y: number, m: number, d: number;
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    [y, m, d] = input.split("-").map(Number);
  } else {
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return "";
    y = date.getFullYear();
    m = date.getMonth() + 1;
    d = date.getDate();
  }
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/** Formats integer cents as "1 234,56 €" (non-breaking spaces, comma decimals). */
export function formatMoney(cents: number | bigint | null | undefined): string {
  if (cents == null) return "";
  if (typeof cents === "number" && !Number.isSafeInteger(cents)) {
    throw new RangeError("Money must be an integer number of cents");
  }
  const big = BigInt(cents);
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "−" : ""}${whole},${frac}${NBSP}€`;
}

/** Parses user input like "1 234,56" or "1234.5" to integer cents. Returns null if invalid. */
export function parseMoneyToCents(input: string): number | null {
  const s = input.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const negative = s.startsWith("-");
  const [w, f = ""] = s.replace("-", "").split(".");
  const cents = Number(w) * 100 + Number(f.padEnd(2, "0"));
  return negative ? -cents : cents;
}
