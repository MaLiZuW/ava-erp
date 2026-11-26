/**
 * Reusable zod field definitions for forms (company, customers, suppliers, …).
 * Optional fields: trimmed, empty string → null (the database stores NULL, not "").
 */
import { z } from "zod";
import { compact, isValidDic, isValidIco } from "./validation";

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
