"use client";

import { useMemo, useState } from "react";
import { AuditTimeline, type AuditEntry } from "@/ui/audit-timeline";
import { FormMessage } from "@/ui/field";
import { Tile } from "@/ui/tile";
import { cn } from "@/ui/cn";
import { useAuditLog, useProfiles } from "../api";
import { FIELD_LABELS, TABLE_LABELS } from "../schema";

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
    ],
  },
  { label: "Firma", tables: ["companies", "documents"] },
  { label: "Systém a funkcie", tables: ["system_settings", "feature_flags"] },
  { label: "Notifikácie", tables: ["notification_recipients"] },
  { label: "Používatelia a 2FA", tables: ["user_roles", "profiles", "auth.mfa_factors"] },
];

function recordLabel(e: AuditEntry): string {
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
  const names = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.email || "Používateľ"])),
    [profiles.data],
  );

  return (
    <Tile size="XL" title="História zmien">
      <div role="group" aria-label="Filter histórie" className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={i === filter}
            onClick={() => setFilter(i)}
            className={cn(
              "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150 ease-out",
              i === filter
                ? "bg-navy border-navy text-white"
                : "hover:bg-canvas text-ink border-neutral-200",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
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
        />
      )}
    </Tile>
  );
}
