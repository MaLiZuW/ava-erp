/**
 * Check of an attachment before upload (D23): extension, MIME type and content ("magic bytes")
 * against the category configuration read from the DB. The DB and the bucket check type and size
 * again (defence in depth); this check gives a clear message before anything is sent.
 */

export interface CategoryRule {
  code: string;
  label: string;
  allowed_mime_types: readonly string[];
  max_bytes: number;
}

/** MIME → extensions; types with a content check below. Other configured types pass by MIME. */
export const KNOWN_TYPES: Record<string, { ext: readonly string[]; label: string }> = {
  "application/pdf": { ext: ["pdf"], label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: ["docx"],
    label: "Word (DOCX)",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    ext: ["xlsx"],
    label: "Excel (XLSX)",
  },
  "image/png": { ext: ["png"], label: "PNG" },
  "image/jpeg": { ext: ["jpg", "jpeg"], label: "JPEG" },
  "image/webp": { ext: ["webp"], label: "WebP" },
};

/** Never accepted, whatever the configuration (same list as public.blocked_mime_types). */
const BLOCKED_EXT = new Set([
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
  "xml",
  "js",
  "mjs",
  "cjs",
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "ps1",
  "sh",
  "php",
  "py",
  "jar",
  "dll",
  "vbs",
  "docm",
  "xlsm",
  "app",
  "apk",
]);

export const typeLabel = (mime: string) => KNOWN_TYPES[mime]?.label ?? mime;

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

function indexOf(bytes: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let k = 0; k < needle.length; k++) if (bytes[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

/**
 * What the content really is. `head` = first bytes, `tail` = last bytes of the file (the ZIP
 * central directory of DOCX/XLSX with the names of its parts is at the end).
 */
export function sniffType(head: Uint8Array, tail: Uint8Array = head): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => head[i + k] === x);
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (at(0, 0x50, 0x4b, 0x03, 0x04)) {
    // Office Open XML = ZIP with [Content_Types].xml; the main part tells Word from Excel
    const both = new Uint8Array(head.length + tail.length);
    both.set(head);
    both.set(tail, head.length);
    if (indexOf(both, ascii("[Content_Types].xml")) < 0) return "application/zip";
    if (indexOf(both, ascii("word/")) >= 0)
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (indexOf(both, ascii("xl/")) >= 0)
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/zip";
  }
  return null;
}

/** MIME of a file: the browser's type, or derived from the extension when the browser has none. */
export function fileMime(file: { name: string; type: string }): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return Object.entries(KNOWN_TYPES).find(([, t]) => t.ext.includes(ext))?.[0] ?? "";
}

export const formatLimit = (bytes: number) =>
  `${String(Math.round((bytes / (1024 * 1024)) * 10) / 10).replace(".", ",")} MB`;

/** null = OK, otherwise a message in Slovak. */
export function checkAttachmentFile(
  file: { name: string; type: string; size: number },
  bytes: { head: Uint8Array; tail?: Uint8Array },
  rule: CategoryRule,
): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXT.has(ext)) return "Tento typ súboru sa z bezpečnostných dôvodov nikdy neprijíma.";
  const mime = fileMime(file);
  if (!mime || !rule.allowed_mime_types.includes(mime)) {
    const allowed = rule.allowed_mime_types.map(typeLabel).join(", ");
    return `Do kategórie „${rule.label}“ patria len: ${allowed}.`;
  }
  const known = KNOWN_TYPES[mime];
  if (known && !known.ext.includes(ext)) return "Prípona súboru nezodpovedá jeho typu.";
  if (file.size === 0) return "Súbor je prázdny.";
  if (file.size > rule.max_bytes)
    return `Súbor je väčší ako ${formatLimit(rule.max_bytes)} (limit kategórie „${rule.label}“).`;
  if (known && sniffType(bytes.head, bytes.tail ?? bytes.head) !== mime)
    return `Obsah súboru nie je platný ${known.label}.`;
  return null;
}

/** Reads the first and last bytes of a file for sniffType. */
export async function readEnds(file: Blob): Promise<{ head: Uint8Array; tail: Uint8Array }> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 64 * 1024)).arrayBuffer());
  return { head, tail };
}

/** Category for a new file: photos for images when allowed, otherwise "other". */
export function defaultCategory(
  file: { name: string; type: string },
  rules: readonly CategoryRule[],
): string {
  const mime = fileMime(file);
  const photo = rules.find((r) => r.code === "photo");
  if (photo?.allowed_mime_types.includes(mime)) return "photo";
  return rules.find((r) => r.code === "other")?.code ?? rules[0]?.code ?? "other";
}
