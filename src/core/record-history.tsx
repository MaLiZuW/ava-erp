"use client";

import { useMemo } from "react";
import { AuditTimeline, type AuditEntry } from "@/ui/audit-timeline";
import { FormMessage } from "@/ui/field";
import { Tile, type TileSize } from "@/ui/tile";
import { useAuditLog, useProfiles } from "./shared-queries";

/**
 * "História zmien" tile of one record (and its child records, e.g. contacts) or of whole tables.
 * activity_logs is admin-only (RLS).
 */
export function RecordHistoryTile({
  tables,
  recordIds,
  fieldLabels,
  recordLabel,
  size = "L",
}: {
  tables: readonly string[];
  /** omitted = whole tables (e.g. the catalog) */
  recordIds?: readonly string[];
  fieldLabels: Record<string, Record<string, string>>;
  recordLabel: (e: AuditEntry) => string;
  size?: TileSize;
}) {
  const log = useAuditLog(tables, { recordIds });
  const profiles = useProfiles();
  const names = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.email || "Používateľ"])),
    [profiles.data],
  );

  return (
    <Tile size={size} title="História zmien" className="md:row-span-3">
      {log.error && <FormMessage tone="error">{log.error.message}</FormMessage>}
      {log.isPending ? (
        <div aria-hidden className="flex animate-pulse flex-col gap-2">
          <div className="bg-canvas h-10 rounded-xl" />
          <div className="bg-canvas h-10 rounded-xl" />
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <AuditTimeline
            entries={log.data ?? []}
            actorName={(id) => (id ? (names.get(id) ?? "Neznámy používateľ") : "Systém")}
            fieldLabel={(t, f) => fieldLabels[t]?.[f] ?? f}
            recordLabel={recordLabel}
          />
        </div>
      )}
    </Tile>
  );
}
