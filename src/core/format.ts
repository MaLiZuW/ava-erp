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

const DATE_TIME = new Intl.DateTimeFormat("sk-SK", {
  timeZone: "Europe/Bratislava",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Formats a timestamp as DD/MM/YYYY HH:mm in Slovak local time (Europe/Bratislava). */
export function formatDateTime(input: Date | string | null | undefined): string {
  if (input == null || input === "") return "";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const p = Object.fromEntries(DATE_TIME.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
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

/** Cents → value for an input field: "1 234,56" (plain spaces, no € sign). */
export function formatMoneyInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return formatMoney(cents).replace(/ /g, " ").replace(/ €$/, "").replace("−", "-");
}

/** Percentage stored as numeric(7,4) → "25" / "12,5" (comma decimals, no trailing zeros). */
export function formatPercent(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10_000) / 10_000).replace(".", ",");
}

/** "12,5" / "12.5" / "12,5 %" → 12.5 (max. 4 decimals, as numeric(7,4)); null if invalid. */
export function parsePercent(input: string): number | null {
  const s = input.replace(/[\s%]/g, "").replace(",", ".");
  if (!/^-?\d{1,3}(\.\d{1,4})?$/.test(s)) return null;
  return Number(s);
}

/** "DD/MM/YYYY" (also D.M.YYYY) → "YYYY-MM-DD"; null if not a real calendar date. */
export function parseDate(input: string): string | null {
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/** Decimal number with comma ("1,5") → 1.5; null if invalid. `decimals` = max. digits after the comma. */
export function parseDecimal(input: string, decimals: number): number | null {
  const s = input.replace(/\s/g, "").replace(",", ".");
  const re = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!re.test(s)) return null;
  return Number(s);
}
