"use client";

/**
 * Queries used by several modules: change history (activity_logs), user names, feature flags.
 * Modules use these instead of importing each other (ARCHITECTURE_CORE.md §4).
 */
import { useQuery } from "@tanstack/react-query";
import type { AuditEntry } from "@/ui/audit-timeline";
import { getSupabase } from "./supabase/client";
import { throwDb } from "./supabase/errors";

const sb = () => getSupabase();

/**
 * Change history of whole tables, or only of some records when `recordIds` is given.
 * `attachmentsOf`: also the attachments (documents) of that record – including deleted ones,
 * which are no longer among the record ids.
 */
export function useAuditLog(
  tables: readonly string[],
  {
    recordIds,
    limit = 30,
    attachmentsOf,
  }: { recordIds?: readonly string[]; limit?: number; attachmentsOf?: string } = {},
) {
  const uuid = /^[0-9a-f-]{36}$/i;
  return useQuery({
    queryKey: [
      "activity_logs",
      ...tables,
      ...(recordIds ? ["records", ...recordIds] : []),
      ...(attachmentsOf ? ["attachments", attachmentsOf] : []),
    ],
    enabled: !recordIds || recordIds.length > 0,
    queryFn: async () => {
      let q = sb()
        .from("activity_logs")
        .select("*")
        .in("table_name", [...tables]);
      if (
        recordIds &&
        attachmentsOf &&
        uuid.test(attachmentsOf) &&
        recordIds.every((r) => uuid.test(r))
      ) {
        q = q.or(
          [
            `record_id.in.(${recordIds.join(",")})`,
            `and(table_name.eq.documents,new_data->>entity_id.eq.${attachmentsOf})`,
            `and(table_name.eq.documents,old_data->>entity_id.eq.${attachmentsOf})`,
          ].join(","),
        );
      } else if (recordIds) q = q.in("record_id", [...recordIds]);
      const { data, error } = await q.order("at", { ascending: false }).limit(limit);
      if (error) throwDb(error);
      return (data ?? []) as AuditEntry[];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await sb().from("profiles").select("id, full_name, email");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

/** Feature flags as a map key → enabled (readable by every aal2 user). */
export function useFeatureFlagMap() {
  return useQuery({
    queryKey: ["feature_flags", "map"],
    queryFn: async () => {
      const { data, error } = await sb().from("feature_flags").select("key, enabled");
      if (error) throwDb(error);
      return Object.fromEntries((data ?? []).map((f) => [f.key, f.enabled])) as Record<
        string,
        boolean
      >;
    },
  });
}

/** True only when the flag is loaded and enabled (hidden while loading). */
export function useFeatureFlag(key: string): boolean {
  return useFeatureFlagMap().data?.[key] === true;
}

/** Active divisions (AVENG, Agentúra) – readable by every aal2 user. */
export function useDivisions() {
  return useQuery({
    queryKey: ["divisions"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("divisions")
        .select("id, code, name")
        .eq("is_active", true)
        .order("name");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}
