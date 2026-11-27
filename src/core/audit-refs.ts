"use client";

/**
 * Names instead of UUIDs in the change history (owner's point 6) – ONE place for the whole
 * system. Every module gets it through RecordHistoryTile / AuditTile; nothing per module.
 *
 * REF_FIELDS maps a column name (in old_data / new_data of activity_logs) to the table whose
 * name it points to. A new reference column = one line here. Names are read through RLS
 * (one query per table); a record that no longer exists is shown as "(zmazaný záznam)".
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AuditEntry, RefResolver } from "@/ui/audit-timeline";
import { getSupabase } from "./supabase/client";

export const DELETED_RECORD = "(zmazaný záznam)";

/** table → columns that make the readable name (first non-empty wins). */
const NAME_COLUMNS: Record<string, string[]> = {
  customers: ["name"],
  suppliers: ["name"],
  catalog_items: ["name"],
  labor_roles: ["name"],
  divisions: ["name"],
  profiles: ["full_name", "email"],
  documents: ["file_name"],
  resources: ["name"],
  companies: ["legal_name"],
  recurring_overheads: ["category"],
  import_batches: ["file_name"],
  content_blocks: ["title"],
  customer_contacts: ["full_name"],
  supplier_contacts: ["full_name"],
  v_bookable_resources: ["display_name"], // person / supplier / equipment name (block H)
};

/** column name → referenced table. */
export const REF_FIELDS: Record<string, string> = {
  customer_id: "customers",
  supplier_id: "suppliers",
  default_supplier_id: "suppliers",
  package_item_id: "catalog_items",
  component_item_id: "catalog_items",
  role_id: "labor_roles",
  division_id: "divisions",
  user_id: "profiles",
  last_reviewed_by: "profiles",
  set_by: "profiles",
  target_user: "profiles",
  equipment_id: "resources",
  profile_id: "profiles",
  resource_id: "v_bookable_resources",
  cost_import_batch_id: "import_batches",
  import_batch_id: "import_batches",
};

/** entity_id is resolved by the entity_table of the same row (documents, data reviews …). */
const ENTITY_TABLES = new Set(Object.keys(NAME_COLUMNS));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which table a field of a row points to (undefined = not a reference). */
export function refTable(field: string, row: Record<string, unknown>): string | undefined {
  if (REF_FIELDS[field]) return REF_FIELDS[field];
  if (field.endsWith("_document_id") || field.endsWith("_document_ids")) return "documents";
  if (
    field === "entity_id" &&
    typeof row.entity_table === "string" &&
    ENTITY_TABLES.has(row.entity_table)
  ) {
    return row.entity_table;
  }
  return undefined;
}

/** table → set of referenced ids found in the given history entries. */
export function collectRefs(entries: readonly AuditEntry[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (table: string, v: unknown) => {
    if (typeof v !== "string" || !UUID.test(v)) return;
    if (!out.has(table)) out.set(table, new Set());
    out.get(table)!.add(v);
  };
  for (const e of entries) {
    for (const data of [e.old_data, e.new_data]) {
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      const row = data as Record<string, unknown>;
      for (const [field, value] of Object.entries(row)) {
        const table = refTable(field, row);
        if (!table) continue;
        if (Array.isArray(value)) value.forEach((x) => add(table, x));
        else add(table, value);
      }
    }
  }
  return out;
}

/** Resolver over loaded names: unknown id of a loaded table → "(zmazaný záznam)". */
export function makeResolver(names: Map<string, Map<string, string>> | undefined): RefResolver {
  return (field, value, row) => {
    const table = refTable(field, row);
    if (!table || typeof value !== "string" || !UUID.test(value)) return undefined;
    const map = names?.get(table);
    if (!map) return undefined; // not loaded yet → raw value for a moment
    return map.get(value) ?? DELETED_RECORD;
  };
}

/** Loads the names referenced by the entries and returns the resolver for AuditTimeline. */
export function useAuditRefs(entries: readonly AuditEntry[] | undefined): RefResolver {
  const refs = useMemo(() => collectRefs(entries ?? []), [entries]);
  const key = useMemo(
    () =>
      [...refs.entries()]
        .map(([t, ids]) => `${t}:${[...ids].sort().join(",")}`)
        .sort()
        .join("|"),
    [refs],
  );
  const names = useQuery({
    queryKey: ["audit_refs", key],
    enabled: refs.size > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const out = new Map<string, Map<string, string>>();
      for (const [table, ids] of refs) {
        const cols = NAME_COLUMNS[table];
        if (!cols) continue;
        // the table names come from the constant above, never from user input
        const { data, error } = await getSupabase()
          .from(table as "customers")
          .select(["id", ...cols].join(", "))
          .in("id", [...ids]);
        const map = new Map<string, string>();
        if (!error) {
          for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
            const name = cols.map((c) => r[c]).find((x) => typeof x === "string" && x !== "");
            map.set(String(r.id), String(name ?? r.id));
          }
        }
        out.set(table, map);
      }
      return out;
    },
  });
  return useMemo(() => makeResolver(names.data), [names.data]);
}
