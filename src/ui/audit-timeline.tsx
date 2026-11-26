import { formatDate, formatDateTime, formatMoney } from "@/core/format";

/** One row of public.activity_logs. */
export interface AuditEntry {
  id: number;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: unknown;
  new_data: unknown;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor: string | null;
  at: string;
}

/**
 * Turns a stored reference (UUID, code) into a readable name: (field, value, row) → name.
 * Returns undefined when the field is not a reference (the raw value is shown).
 */
export type RefResolver = (
  field: string,
  value: unknown,
  row: Record<string, unknown>,
) => string | undefined;

export interface AuditChange {
  field: string;
  from: string;
  to: string;
}

const HIDDEN_FIELDS = new Set(["id", "created_at", "created_by", "updated_at", "updated_by"]);
const MAX_VALUE = 80;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const decimalComma = (n: number) => String(n).replace(".", ",");

function clip(s: string): string {
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1)}…` : s;
}

/**
 * A value in Slovak format (owner's point 11): decimal comma, *_cents as € with 2 decimals,
 * *_pct as "12,5 %", dates DD/MM/YYYY, timestamps DD/MM/YYYY HH:mm, áno/nie, lists with commas.
 * References (UUID) are replaced by names through `resolve`.
 */
export function displayValue(
  v: unknown,
  field = "",
  resolve?: RefResolver,
  row: Record<string, unknown> = {},
): string {
  if (v === null || v === undefined || v === "") return "—";
  const named = resolve?.(field, v, row);
  if (named !== undefined) return clip(named);
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return clip(v.map((x) => resolve?.(field, x, row) ?? displayValue(x, field)).join(", "));
  }
  if (typeof v === "boolean") return v ? "áno" : "nie";
  if (typeof v === "number") {
    if (field.endsWith("_cents") && Number.isSafeInteger(v)) return formatMoney(v);
    if (field.endsWith("_pct")) return `${decimalComma(v)} %`;
    return decimalComma(v);
  }
  if (typeof v === "string") {
    if (ISO_DATE.test(v)) return formatDate(v);
    if (ISO_TIMESTAMP.test(v)) return formatDateTime(v);
    return clip(v);
  }
  return clip(JSON.stringify(v));
}

/** Field-level differences of one log entry (audit columns are ignored). */
export function auditChanges(
  entry: Pick<AuditEntry, "action" | "old_data" | "new_data">,
  resolve?: RefResolver,
): AuditChange[] {
  const before = asRecord(entry.old_data);
  const after = asRecord(entry.new_data);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: AuditChange[] = [];
  for (const field of keys) {
    if (HIDDEN_FIELDS.has(field)) continue;
    const a = JSON.stringify(before[field] ?? null);
    const b = JSON.stringify(after[field] ?? null);
    if (entry.action === "update" && a === b) continue;
    if (entry.action === "insert" && (after[field] ?? null) === null) continue;
    if (entry.action === "delete" && (before[field] ?? null) === null) continue;
    out.push({
      field,
      from: entry.action === "insert" ? "" : displayValue(before[field], field, resolve, before),
      to: entry.action === "delete" ? "" : displayValue(after[field], field, resolve, after),
    });
  }
  return out;
}

const ACTION_LABEL: Record<string, string> = {
  insert: "Vytvorené",
  update: "Zmenené",
  delete: "Odstránené",
  transition: "Zmena stavu",
};

/**
 * Change history (who, when, what) – docs/DESIGN_SYSTEM.md §8 "AuditTimeline".
 * Reused by document detail pages in later phases.
 */
export function AuditTimeline({
  entries,
  actorName,
  fieldLabel = (_t, f) => f,
  recordLabel,
  resolveRef,
  emptyText = "Zatiaľ bez zmien.",
}: {
  entries: AuditEntry[];
  actorName: (actorId: string | null) => string;
  fieldLabel?: (table: string, field: string) => string;
  recordLabel?: (entry: AuditEntry) => string;
  /** names instead of UUIDs – see src/core/audit-refs.ts */
  resolveRef?: RefResolver;
  emptyText?: string;
}) {
  if (entries.length === 0) return <p className="text-neutral-700">{emptyText}</p>;
  return (
    <ol className="flex flex-col" aria-label="História zmien">
      {entries.map((e) => {
        const changes = auditChanges(e, resolveRef);
        return (
          <li key={e.id} className="border-b border-neutral-200 py-3 last:border-b-0">
            <p className="text-[13px] leading-5 text-neutral-700">
              <time dateTime={e.at} className="tabular-nums">
                {formatDateTime(e.at)}
              </time>
              {" · "}
              <span className="text-ink font-medium">{actorName(e.actor)}</span>
              {" · "}
              {ACTION_LABEL[e.action] ?? e.action}
              {recordLabel && <> · {recordLabel(e)}</>}
            </p>
            {e.action === "transition" ? (
              <p className="text-[15px]">
                {e.from_status} → {e.to_status}
                {e.note && <span className="text-neutral-700"> ({e.note})</span>}
              </p>
            ) : (
              changes.length > 0 && (
                <dl className="mt-1 grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-0.5 text-[13px] leading-5">
                  {changes.map((c) => (
                    <div key={c.field} className="contents">
                      <dt className="text-neutral-700">{fieldLabel(e.table_name, c.field)}</dt>
                      <dd className="text-ink break-words">
                        {e.action === "update" ? (
                          <>
                            <span className="text-neutral-500 line-through">{c.from}</span> → {c.to}
                          </>
                        ) : (
                          c.to || c.from
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )
            )}
          </li>
        );
      })}
    </ol>
  );
}
