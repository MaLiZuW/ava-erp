/**
 * Readable change history (owner's point 22) – ONE place for:
 *  - technical fields that are never shown (checksum, storage path, ids, version …),
 *  - human values (file size in kB / MB, "PNG obrázok"),
 *  - the main line of an entry as a sentence ("Nahraté logo logo.png (2,3 kB)").
 * Sentences are impersonal (participles), so they never guess a person's grammatical gender
 * from a name; the person is shown next to the sentence.
 */
import type { AuditEntry, RefResolver } from "@/ui/audit-timeline";

export const HIDDEN_AUDIT_FIELDS = new Set([
  "id",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "sha256",
  "storage_path",
  "storage_bucket",
  "storage_provider",
  "version",
  "entity_table",
  "entity_id",
  "is_locked",
  "retention_until",
  "vault_secret_id",
]);

const MIME_LABELS: Record<string, string> = {
  "image/png": "PNG obrázok",
  "image/jpeg": "JPEG obrázok",
  "image/webp": "WebP obrázok",
  "application/pdf": "PDF dokument",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word dokument (DOCX)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel tabuľka (XLSX)",
};

const CATEGORY_LABELS: Record<string, string> = {
  logo: "logo",
  content_image: "obrázok obsahu",
};

/** 2345 → "2,3 kB", 1 572 864 → "1,5 MB". */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${String(Math.round(kb * 10) / 10).replace(".", ",")} kB`;
  return `${String(Math.round((kb / 1024) * 10) / 10).replace(".", ",")} MB`;
}

/** Human value for special fields; undefined = the general Slovak formatting applies. */
export function humanFieldValue(field: string, value: unknown): string | undefined {
  if (field === "size_bytes" && typeof value === "number") return formatBytes(value);
  if (field === "mime_type" && typeof value === "string") return MIME_LABELS[value] ?? "súbor";
  if (field === "category" && typeof value === "string" && CATEGORY_LABELS[value])
    return CATEGORY_LABELS[value];
  return undefined;
}

const VERB: Record<string, string> = {
  insert: "Vytvorené",
  update: "Zmenené",
  delete: "Odstránené",
  transition: "Zmena stavu",
};

const row = (e: AuditEntry) => (e.new_data ?? e.old_data ?? {}) as Record<string, unknown>;

/** Main line of a history entry as a sentence. */
export function describeAuditEntry(
  e: AuditEntry,
  resolve: RefResolver | undefined,
  recordLabel?: (e: AuditEntry) => string,
): string {
  const d = row(e);
  if (e.table_name === "documents") {
    const file = String(d.file_name ?? "súbor");
    const size = typeof d.size_bytes === "number" ? ` (${formatBytes(d.size_bytes)})` : "";
    const block =
      d.entity_table === "content_blocks" ? resolve?.("entity_id", d.entity_id, d) : undefined;
    if (d.category === "logo") {
      if (e.action === "insert") return `Nahraté logo ${file}${size}`;
      if (e.action === "delete") return `Odstránené logo ${file}`;
      return `Zmenené logo ${file}`;
    }
    if (d.category === "content_image") {
      const where = block ? ` ${e.action === "delete" ? "z bloku" : "do bloku"} ${block}` : "";
      if (e.action === "insert") return `Nahratý obrázok ${file}${size}${where}`;
      if (e.action === "delete") return `Odstránený obrázok ${file}${where}`;
      return `Zmenený obrázok ${file}${where}`;
    }
    if (e.action === "insert") return `Nahraný súbor ${file}${size}`;
    if (e.action === "delete") return `Odstránený súbor ${file}`;
    return `Zmenený súbor ${file}`;
  }
  if (e.table_name === "companies" && e.action === "update") {
    const a = (e.old_data ?? {}) as Record<string, unknown>;
    const b = (e.new_data ?? {}) as Record<string, unknown>;
    const changed = Object.keys({ ...a, ...b }).filter(
      (k) =>
        !HIDDEN_AUDIT_FIELDS.has(k) &&
        JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null),
    );
    if (changed.length === 1 && changed[0] === "logo_document_id") return "Zmenené logo firmy";
    return "Zmenené údaje firmy";
  }
  const what = recordLabel?.(e);
  return `${VERB[e.action] ?? e.action}${what ? `: ${what}` : ""}`;
}
