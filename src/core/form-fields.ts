/**
 * Reusable zod field definitions for forms (company, customers, suppliers, …).
 * Optional fields: trimmed, empty string → null (the database stores NULL, not "").
 */
import { z } from "zod";
import { parseDate, parseDecimal, parseMoneyToCents, parsePercent } from "./format";
import { compact, isValidDic, isValidGtin, isValidIco } from "./validation";

/** Optional text: trimmed, empty → null. */
export const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Najviac ${max} znakov.`)
    .transform((v) => (v === "" ? null : v));

/** Optional text with a check; the value is normalised when present. */
export const optChecked = (
  check: (v: string) => boolean,
  message: string,
  normalize: (v: string) => string = (v) => v,
) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || check(v), message)
    .transform((v) => (v === "" ? null : normalize(v)));

export const gtinField = () =>
  optChecked(
    isValidGtin,
    "EAN/GTIN nie je platný: 8, 12, 13 alebo 14 číslic so správnou kontrolnou číslicou.",
    compact,
  );

export const icoField = () =>
  optChecked(isValidIco, "IČO nie je platné (8 číslic s kontrolnou číslicou).", compact);

export const dicField = () => optChecked(isValidDic, "DIČ má 10 číslic.", compact);

/** IČ DPH of any EU country: 2 letters + 2–13 characters (e.g. SK2020123456, CZ12345678). */
export const icDphField = () =>
  optChecked(
    (v) => /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(compact(v).toUpperCase()),
    "IČ DPH má tvar kód krajiny + číslo (napr. SK2020123456).",
    (v) => compact(v).toUpperCase(),
  );

const SK_ZIP = /^\d{3}\s?\d{2}$/;
export const ZIP_MESSAGE = "PSČ má 5 číslic (napr. 811 01).";
/** Countries whose post code has the form "811 01". */
export const FIVE_DIGIT_ZIP_COUNTRIES = ["SK", "CZ"];
export const isFiveDigitZip = (v: string) => /^\d{3} \d{2}$/.test(v);

/**
 * Post code. `strict`: must be "811 01" (Slovak company). Otherwise any text up to 20 characters;
 * a 5-digit value is formatted as "811 01" (the form checks SK/CZ against the country).
 */
export const zipField = (strict = true) =>
  optChecked(
    (v) => (strict ? SK_ZIP.test(v) : v.length <= 20),
    strict ? ZIP_MESSAGE : "Najviac 20 znakov.",
    (v) => {
      if (!SK_ZIP.test(v)) return v;
      const c = compact(v);
      return `${c.slice(0, 3)} ${c.slice(3)}`;
    },
  );

export const countryField = () =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Kód krajiny má 2 písmená (SK).");

export const emailField = () =>
  optChecked(
    (v) => z.email().safeParse(v).success,
    "Zadajte platný e-mail.",
    (v) => v.toLowerCase(),
  );

export const phoneField = () =>
  optChecked((v) => /^\+?[0-9 ()/-]{6,20}$/.test(v), "Zadajte platné telefónne číslo.");

export const webField = () =>
  optChecked(
    (v) => /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v),
    "Zadajte platnú adresu webu.",
  );

/** Optional whole number in a range; "" → null. */
export const optInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), message)
    .transform((v) => (v === "" ? null : Number(v)));

// --- money, percentages, dates (inputs are text; values are stored as cents / numeric / ISO date) ---

const MAX_CENTS = 100_000_000_000; // 1 000 000 000,00 € – far above any real amount

/** Amount in euros ("1 234,56") → integer cents >= 0. Required. */
export const moneyField = (message = "Zadajte sumu v eurách, napr. 1 234,56.") =>
  z.string().transform((v, ctx) => {
    const cents = parseMoneyToCents(v);
    if (cents == null || cents < 0 || cents > MAX_CENTS) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

/** Optional amount: "" → null. */
export const optMoneyField = (message = "Zadajte sumu v eurách, napr. 1 234,56.") =>
  z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const cents = parseMoneyToCents(v);
    if (cents == null || cents < 0 || cents > MAX_CENTS) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

/** Optional percentage 0–max ("12,5") → number; "" → null. */
export const optPercentField = (max = 999.9999) =>
  z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const n = parsePercent(v);
    if (n == null || n < 0 || n > max) {
      ctx.addIssue({
        code: "custom",
        message: `Zadajte percentá 0–${String(max).replace(".", ",")}.`,
      });
      return z.NEVER;
    }
    return n;
  });

/** Date DD/MM/YYYY → "YYYY-MM-DD". Required. */
export const dateField = () =>
  z.string().transform((v, ctx) => {
    const iso = parseDate(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Zadajte dátum v tvare DD/MM/YYYY." });
      return z.NEVER;
    }
    return iso;
  });

/** Optional date DD/MM/YYYY; "" → null. */
export const optDateField = () =>
  z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const iso = parseDate(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Zadajte dátum v tvare DD/MM/YYYY." });
      return z.NEVER;
    }
    return iso;
  });

/** Positive decimal number (e.g. hours, quantity) with at most `decimals` digits after the comma. */
export const positiveDecimalField = (decimals: number, message: string) =>
  z.string().transform((v, ctx) => {
    const n = parseDecimal(v, decimals);
    if (n == null || n <= 0) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return n;
  });
