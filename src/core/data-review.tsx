"use client";

/**
 * Periodic review of data (owner's point 13) – one mechanism for all tables:
 * data_reviews (next date per record) + v_reviews_due (current records, state computed on read).
 * <ReviewControl> shows "Overiť do DD/MM/YYYY" / "Po termíne" and "Potvrdiť bez zmeny".
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/ui/button";
import { StatusBadge } from "@/ui/status-badge";
import { formatDate } from "./format";
import { getSupabase } from "./supabase/client";
import { throwDb } from "./supabase/errors";

export type ReviewState = "overdue" | "due_soon" | "ok";

/** Where a record is edited (link from "Na overenie" and the dashboard). */
export const REVIEW_HREFS: Record<string, string> = {
  recurring_overheads: "/nastavenia/reporting/rezia/",
  labor_rates: "/katalog/?tab=sadzby",
  resources: "/katalog/?tab=technika",
  income_tax_brackets: "/nastavenia/reporting/dane/",
  work_patterns: "/nastavenia/reporting/kapacity/",
  companies: "/nastavenia/firma/",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Same rule as v_reviews_due: past date = overdue, within 30 days = due soon. */
export function reviewState(nextReviewAt: string, today = new Date()): ReviewState {
  const t = iso(today);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  if (nextReviewAt < t) return "overdue";
  if (nextReviewAt <= iso(soon)) return "due_soon";
  return "ok";
}

export interface ReviewRow {
  entity_table: string;
  entity_id: string;
  label: string;
  record_name: string;
  next_review_at: string;
  last_reviewed_at: string | null;
  state: ReviewState;
}

/** All current records with their review (Dáta → Na overenie, dashboard, settings marker). */
export function useReviewsDue() {
  return useQuery({
    queryKey: ["data_reviews", "due"],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("v_reviews_due")
        .select(
          "entity_table, entity_id, label, record_name, next_review_at, last_reviewed_at, state",
        )
        .order("next_review_at");
      if (error) throwDb(error);
      return (data ?? []) as ReviewRow[];
    },
  });
}

/** Reviews of one table as a map id → row (one query per table, cached). */
function useTableReviews(entityTable: string) {
  return useQuery({
    queryKey: ["data_reviews", entityTable],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("data_reviews")
        .select("entity_id, next_review_at, last_reviewed_at")
        .eq("entity_table", entityTable);
      if (error) throwDb(error);
      return new Map((data ?? []).map((r) => [r.entity_id, r]));
    },
  });
}

export function useConfirmReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityTable, entityId }: { entityTable: string; entityId: string }) => {
      const { error } = await getSupabase().rpc("confirm_data_review", {
        p_entity_table: entityTable,
        p_entity_id: entityId,
      });
      if (error) throwDb(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["data_reviews"] });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

/** Records that need attention: overdue first, then due within 30 days. */
export function dueOnly(rows: ReviewRow[]): ReviewRow[] {
  const rank = { overdue: 0, due_soon: 1, ok: 2 } as const;
  return rows
    .filter((r) => r.state !== "ok")
    .sort(
      (a, b) => rank[a.state] - rank[b.state] || a.next_review_at.localeCompare(b.next_review_at),
    );
}

/** List of reviews with state, confirm and a link to where the record is edited. */
export function ReviewsList({ rows, limit }: { rows: ReviewRow[]; limit?: number }) {
  const confirm = useConfirmReview();
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-neutral-200" aria-label="Záznamy na overenie">
        {shown.map((r) => (
          <li
            key={`${r.entity_table}-${r.entity_id}`}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
            data-testid="review-row"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{r.record_name}</p>
              <p className="text-[13px] text-neutral-700">{r.label}</p>
            </div>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={
                  r.state === "overdue"
                    ? `Po termíne (${formatDate(r.next_review_at)})`
                    : `Overiť do ${formatDate(r.next_review_at)}`
                }
                tone={
                  r.state === "overdue" ? "danger" : r.state === "due_soon" ? "warning" : "neutral"
                }
              />
              {r.state !== "ok" && (
                <Button
                  variant="ghost"
                  className="h-8 px-2 text-[13px]"
                  disabled={confirm.isPending}
                  onClick={() =>
                    confirm.mutate({ entityTable: r.entity_table, entityId: r.entity_id })
                  }
                  aria-label={`Potvrdiť bez zmeny – ${r.record_name}`}
                >
                  Potvrdiť bez zmeny
                </Button>
              )}
              {REVIEW_HREFS[r.entity_table] && (
                <Link
                  href={REVIEW_HREFS[r.entity_table]}
                  className="text-navy text-[13px] font-medium hover:underline"
                >
                  Upraviť →
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
      {confirm.error && <p className="text-danger text-[13px]">{confirm.error.message}</p>}
    </div>
  );
}

/** Badge + "Potvrdiť bez zmeny" for one record (shown when the review is due or overdue). */
export function ReviewControl({
  entityTable,
  entityId,
  always = false,
}: {
  entityTable: string;
  entityId: string;
  /** show the date also when the review is not due yet */
  always?: boolean;
}) {
  const reviews = useTableReviews(entityTable);
  const confirm = useConfirmReview();
  const r = reviews.data?.get(entityId);
  if (!r) return null;
  const state = reviewState(r.next_review_at);
  if (state === "ok" && !always) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="review-control">
      <StatusBadge
        label={
          state === "overdue"
            ? `Po termíne overenia (${formatDate(r.next_review_at)})`
            : `Overiť do ${formatDate(r.next_review_at)}`
        }
        tone={state === "overdue" ? "danger" : state === "due_soon" ? "warning" : "neutral"}
      />
      {state !== "ok" && (
        <Button
          variant="ghost"
          className="h-8 px-2 text-[13px]"
          disabled={confirm.isPending}
          onClick={() => confirm.mutate({ entityTable, entityId })}
        >
          Potvrdiť bez zmeny
        </Button>
      )}
    </span>
  );
}
