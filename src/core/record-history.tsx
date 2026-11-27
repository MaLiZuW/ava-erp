"use client";

import { useMemo } from "react";
import { AuditTimeline, type AuditEntry, type RefResolver } from "@/ui/audit-timeline";
import { describeAuditEntry } from "./audit-describe";
import { useAuditRefs } from "./audit-refs";
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
  size = "XL",
  filter,
  attachmentsOf,
}: {
  tables: readonly string[];
  /** omitted = whole tables (e.g. the catalog) */
  recordIds?: readonly string[];
  fieldLabels: Record<string, Record<string, string>>;
  /** short name of the changed record; `resolve` turns referenced ids into names */
  recordLabel: (e: AuditEntry, resolve: RefResolver) => string;
  size?: TileSize;
  /** narrows the entries of shared tables (e.g. documents → only the logo) */
  filter?: (e: AuditEntry) => boolean;
  /** include attachments of this record, also deleted ones (D23) */
  attachmentsOf?: string;
}) {
  // more rows are read when a filter narrows them; 30 are shown
  const log = useAuditLog(tables, { recordIds, limit: filter ? 150 : 30, attachmentsOf });
  const entries = useMemo(
    () => (filter ? (log.data ?? []).filter(filter).slice(0, 30) : (log.data ?? [])),
    [log.data, filter],
  );
  const profiles = useProfiles();
  const resolve = useAuditRefs(entries);
  const names = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.email || "Používateľ"])),
    [profiles.data],
  );

  return (
    <Tile size={size} title="História zmien">
      {log.error && <FormMessage tone="error">{log.error.message}</FormMessage>}
      {log.isPending ? (
        <div aria-hidden className="flex animate-pulse flex-col gap-2">
          <div className="bg-canvas h-10 rounded-xl" />
          <div className="bg-canvas h-10 rounded-xl" />
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <AuditTimeline
            entries={entries}
            actorName={(id) => (id ? (names.get(id) ?? "Neznámy používateľ") : "Systém")}
            fieldLabel={(t, f) => fieldLabels[t]?.[f] ?? f}
            recordLabel={(e) => recordLabel(e, resolve)}
            describe={(e) => describeAuditEntry(e, resolve, (x) => recordLabel(x, resolve))}
            resolveRef={resolve}
          />
        </div>
      )}
    </Tile>
  );
}
