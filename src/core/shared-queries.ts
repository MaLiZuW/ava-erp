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

/** Change history of whole tables, or only of some records when `recordIds` is given. */
export function useAuditLog(
  tables: readonly string[],
  { recordIds, limit = 30 }: { recordIds?: readonly string[]; limit?: number } = {},
) {
  return useQuery({
    queryKey: ["activity_logs", ...tables, ...(recordIds ? ["records", ...recordIds] : [])],
    enabled: !recordIds || recordIds.length > 0,
    queryFn: async () => {
      let q = sb()
        .from("activity_logs")
        .select("*")
        .in("table_name", [...tables]);
      if (recordIds) q = q.in("record_id", [...recordIds]);
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
