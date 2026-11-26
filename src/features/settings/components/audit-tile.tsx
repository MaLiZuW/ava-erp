"use client";

import { useMemo, useState } from "react";
import { AuditTimeline, type AuditEntry } from "@/ui/audit-timeline";
import { FormMessage } from "@/ui/field";
import { ChipGroup } from "@/ui/chips";
import { Tile } from "@/ui/tile";
import { useAuditRefs } from "@/core/audit-refs";
import { useAuditLog, useProfiles } from "../api";
import { FIELD_LABELS, TABLE_LABELS } from "../schema";
import { REPORTING_TABLES } from "../reporting";

const FILTERS: { label: string; tables: string[] }[] = [
  {
    label: "Všetko",
    tables: [
      "companies",
      "documents",
      "system_settings",
      "feature_flags",
      "notification_recipients",
      "user_roles",
      "profiles",
      "auth.mfa_factors",
      ...REPORTING_TABLES,
    ],
  },
  { label: "Firma", tables: ["companies", "documents"] },
  { label: "Systém a funkcie", tables: ["system_settings", "feature_flags"] },
  { label: "Notifikácie", tables: ["notification_recipients"] },
  { label: "Používatelia a 2FA", tables: ["user_roles", "profiles", "auth.mfa_factors"] },
  { label: "Reporting", tables: [...REPORTING_TABLES] },
];

export function recordLabel(e: AuditEntry): string {
  const table = TABLE_LABELS[e.table_name] ?? e.table_name;
  const data = (e.new_data ?? e.old_data) as Record<string, unknown> | null;
  const key =
    typeof data?.key === "string" ? data.key : typeof data?.email === "string" ? data.email : null;
  return key ? `${table}: ${key}` : table;
}

/** Change history of the settings (who, when, what) – activity_logs, admin only (RLS). */
export function AuditTile() {
  const [filter, setFilter] = useState(0);
  const log = useAuditLog(FILTERS[filter].tables);
  const profiles = useProfiles();
  const resolve = useAuditRefs(log.data);
  const names = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.email || "Používateľ"])),
    [profiles.data],
  );

  return (
    <Tile size="XL" title="História zmien">
      <ChipGroup
        label="Filter histórie"
        className="mb-3"
        options={FILTERS.map((f, i) => ({ value: i, label: f.label }))}
        value={filter}
        onChange={setFilter}
      />
      {log.error && <FormMessage tone="error">{log.error.message}</FormMessage>}
      {log.isPending ? (
        <div aria-hidden className="flex animate-pulse flex-col gap-2">
          <div className="bg-canvas h-10 rounded-xl" />
          <div className="bg-canvas h-10 rounded-xl" />
        </div>
      ) : (
        <AuditTimeline
          entries={log.data ?? []}
          actorName={(id) => (id ? (names.get(id) ?? "Neznámy používateľ") : "Systém")}
          fieldLabel={(t, f) => FIELD_LABELS[t]?.[f] ?? f}
          recordLabel={recordLabel}
          resolveRef={resolve}
        />
      )}
    </Tile>
  );
}
