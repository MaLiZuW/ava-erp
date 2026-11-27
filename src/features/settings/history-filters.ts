import type { AuditEntry } from "@/ui/audit-timeline";

/**
 * Which history entries belong to a settings page (owner's point 22). The tables of a page
 * come from SETTINGS_GROUPS; this narrows shared tables (documents, companies) further.
 */
const data = (e: AuditEntry) => (e.new_data ?? e.old_data ?? {}) as Record<string, unknown>;

/** Fields that really changed (audit columns ignored). */
export function changedFields(e: AuditEntry): string[] {
  const a = (e.old_data ?? {}) as Record<string, unknown>;
  const b = (e.new_data ?? {}) as Record<string, unknown>;
  return Object.keys({ ...a, ...b }).filter(
    (k) =>
      !["updated_at", "updated_by"].includes(k) &&
      JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null),
  );
}

export const isLogoDocument = (e: AuditEntry) =>
  e.table_name === "documents" && data(e).category === "logo";

const onlyLogoChange = (e: AuditEntry) =>
  e.table_name === "companies" &&
  e.action === "update" &&
  changedFields(e).every((k) => k === "logo_document_id");

/** In the settings, documents mean the company logo only (content images belong to Dokumenty). */
export const isSettingsEntry = (e: AuditEntry) => e.table_name !== "documents" || isLogoDocument(e);

export const HISTORY_FILTERS: Record<string, (e: AuditEntry) => boolean> = {
  "/nastavenia/firma/logo/": (e) =>
    isLogoDocument(e) ||
    (e.table_name === "companies" && changedFields(e).includes("logo_document_id")),
  "/nastavenia/firma/": (e) => e.table_name === "companies" && !onlyLogoChange(e),
  // AI page: its tables and only the AI keys of the shared settings and flags
  "/nastavenia/ai/": (e) => {
    if (e.table_name === "ai_provider_keys" || e.table_name === "ai_model_prices") return true;
    const key = ((e.new_data ?? e.old_data) as { key?: string } | null)?.key ?? "";
    return key.startsWith("ai_");
  },
};
