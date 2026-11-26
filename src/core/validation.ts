/**
 * Shared validators (Slovak identifiers, bank details, uploaded files).
 * Used by zod schemas in features; tested in validation.test.ts.
 */

/** Removes spaces (users often type "357 634 69"). */
export const compact = (v: string) => v.replace(/\s+/g, "");

/**
 * IČO (SK/CZ company id): 8 digits, last digit is a mod-11 check digit with weights 8…2.
 * r = Σ dᵢ·wᵢ mod 11; check = r == 0 ? 1 : r == 1 ? 0 : 11 − r.
 */
export function isValidIco(input: string): boolean {
  const v = compact(input);
  if (!/^\d{8}$/.test(v)) return false;
  const digits = v.split("").map(Number);
  const sum = digits.slice(0, 7).reduce((s, d, i) => s + d * (8 - i), 0);
  const r = sum % 11;
  const check = r === 0 ? 1 : r === 1 ? 0 : 11 - r;
  return check === digits[7];
}

/** DIČ (SK tax id): 10 digits. */
export function isValidDic(input: string): boolean {
  return /^\d{10}$/.test(compact(input));
}

/** IBAN: country code, 2 check digits, BBAN; ISO 13616 mod-97 check. SK IBAN has 24 characters. */
export function isValidIban(input: string): boolean {
  const v = compact(input).toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  if (v.startsWith("SK") && v.length !== 24) return false;
  const rearranged = v.slice(4) + v.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const n = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of n) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** IBAN in groups of four for display: "SK31 1200 0000 …". */
export function formatIban(input: string): string {
  return compact(input)
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** SWIFT / BIC: 8 or 11 characters. */
export function isValidSwift(input: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compact(input).toUpperCase());
}

// ---------------------------------------------------------------------------------------------
// Image upload (logo, content images): PNG / JPEG / WebP only, max 2 MB. SVG is refused
// (it can carry scripts). The documents table enforces the same rule (phase 3).
// Checked three ways: extension, declared MIME type and the file's magic bytes.
// The storage bucket enforces MIME type and size again on the server.
// ---------------------------------------------------------------------------------------------
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;
export const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

function sniffImage(bytes: Uint8Array): ImageMime | null {
  const at = (i: number, ...vals: number[]) => vals.every((v, k) => bytes[i + k] === v);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** Returns an error message, or null when the file is an allowed image (logo, content image). */
export function checkImageFile(
  file: { name: string; type: string; size: number },
  head: Uint8Array,
): string | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const mime = file.type.toLowerCase();
  if (!(mime in IMAGE_TYPES)) return "Povolené sú len obrázky PNG, JPEG alebo WebP (SVG nie).";
  if (!(IMAGE_TYPES[mime as ImageMime] as readonly string[]).includes(ext))
    return "Prípona súboru nezodpovedá jeho typu.";
  if (file.size > IMAGE_MAX_BYTES) return "Súbor je väčší ako 2 MB.";
  if (file.size === 0) return "Súbor je prázdny.";
  if (sniffImage(head) !== mime) return "Obsah súboru nie je platný obrázok PNG, JPEG alebo WebP.";
  return null;
}

/** Storage-safe file name: ASCII letters, digits, dot, dash, underscore; max 80 chars. */
export function safeFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "");
  return (base || "subor").slice(-80);
}
