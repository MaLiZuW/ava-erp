"use client";

import { useMemo, useState } from "react";
import { FREQUENCY_LABELS, overheadMonthShare, type Frequency } from "@/core/calc/overhead-share";
import { ReviewControl } from "@/core/data-review";
import { formatDate, formatMoney, parseMoneyToCents } from "@/core/format";
import { useDivisions } from "@/core/shared-queries";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Field, FormMessage, Input, Select } from "@/ui/field";
import { MoneyInput } from "@/ui/inputs";
import { StatusBadge } from "@/ui/status-badge";
import { monthOptions } from "../../reporting";
import {
  useAddRecurring,
  useEndRecurring,
  useRecurringOverheads,
  useReviseRecurring,
  type RecurringOverhead,
} from "../../reporting-api";

const thisMonth = () => monthOptions()[12].value;
const lastDayOf = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
const monthLabel = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function MonthSelect({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Field id={id} label={label} className="w-40">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {monthOptions().map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** New recurring cost: category, division, amount, frequency, from a month. */
export function RecurringForm({ onDone }: { onDone: () => void }) {
  const add = useAddRecurring();
  const divisions = useDivisions();
  const [category, setCategory] = useState("");
  const [division, setDivision] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [from, setFrom] = useState(thisMonth());
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const cents = parseMoneyToCents(amount);
  const share =
    cents != null && cents >= 0 ? overheadMonthShare(cents, frequency, from, from) : null;

  const submit = async () => {
    setProblem(null);
    if (!category.trim()) return setProblem("Zadajte kategóriu (napr. nájom).");
    if (cents == null || cents < 0) return setProblem("Zadajte sumu v eurách (0 alebo viac).");
    const ok = await add
      .mutateAsync({
        category: category.trim(),
        division_id: division || null,
        amount_cents: cents,
        frequency,
        valid_from: from,
        note: note.trim() || null,
      })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  };

  return (
    <section
      aria-label="Nový opakovaný náklad"
      className="bg-canvas/50 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field id="rec-category" label="Kategória" className="md:col-span-2">
          <Input id="rec-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field id="rec-division" label="Divízia">
          <Select id="rec-division" value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="">Spoločná (celá firma)</option>
            {(divisions.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="rec-amount" label="Suma za obdobie">
          <MoneyInput id="rec-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field id="rec-frequency" label="Frekvencia">
          <Select
            id="rec-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
          >
            {Object.entries(FREQUENCY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <MonthSelect id="rec-from" label="Platí od mesiaca" value={from} onChange={setFrom} />
        <Field id="rec-note" label="Poznámka" className="md:col-span-3">
          <Input id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {share != null && frequency !== "monthly" && (
        <p className="text-[13px] text-neutral-700" data-testid="recurring-share-preview">
          Do mesačného prehľadu sa rozpočíta {formatMoney(share)} mesačne.
        </p>
      )}
      {(problem || add.error) && (
        <FormMessage tone="error">{problem ?? add.error?.message}</FormMessage>
      )}
      <div className="flex gap-2">
        <Button onClick={() => void submit()} disabled={add.isPending}>
          Uložiť opakovaný náklad
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </section>
  );
}

/** "Zmeniť sumu od…" (new version) or "Ukončiť k…" for one current version. */
function ChangeForm({
  row,
  mode,
  onDone,
}: {
  row: RecurringOverhead;
  mode: "revise" | "end";
  onDone: () => void;
}) {
  const revise = useReviseRecurring();
  const end = useEndRecurring();
  // monthOptions(): index 12 = this month, 13 = next month
  const [month, setMonth] = useState(monthOptions()[mode === "revise" ? 13 : 12].value);
  const [amount, setAmount] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const busy = revise.isPending || end.isPending;
  const error = revise.error ?? end.error;

  const submit = async () => {
    setProblem(null);
    let ok: boolean;
    if (mode === "revise") {
      const cents = parseMoneyToCents(amount);
      if (cents == null || cents < 0) return setProblem("Zadajte novú sumu v eurách.");
      ok = await revise
        .mutateAsync({ id: row.id, amount_cents: cents, effective_from: month })
        .then(() => true)
        .catch(() => false);
    } else {
      ok = await end
        .mutateAsync({ id: row.id, valid_to: lastDayOf(month) })
        .then(() => true)
        .catch(() => false);
    }
    if (ok) onDone();
  };

  return (
    <div className="bg-canvas/50 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 p-3">
      {mode === "revise" && (
        <Field id={`rev-amount-${row.id}`} label="Nová suma za obdobie" className="w-48">
          <MoneyInput
            id={`rev-amount-${row.id}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      )}
      <MonthSelect
        id={`rev-month-${row.id}`}
        label={mode === "revise" ? "Platí od mesiaca" : "Posledný mesiac"}
        value={month}
        onChange={setMonth}
      />
      <Button onClick={() => void submit()} disabled={busy}>
        {mode === "revise" ? "Uložiť novú verziu" : "Ukončiť"}
      </Button>
      <Button variant="ghost" onClick={onDone}>
        Zrušiť
      </Button>
      {(problem || error) && (
        <div className="w-full">
          <FormMessage tone="error">{problem ?? error?.message}</FormMessage>
        </div>
      )}
    </div>
  );
}

/** Recurring costs: current versions, monthly share, review state, history of versions. */
export function RecurringOverheadPanel() {
  const rows = useRecurringOverheads();
  const divisions = useDivisions();
  const [change, setChange] = useState<{ id: string; mode: "revise" | "end" } | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const month = thisMonth();
  const divisionName = (id: string | null) =>
    id ? (divisions.data?.find((d) => d.id === id)?.name ?? "—") : "Spoločná";
  const key = (r: RecurringOverhead) => `${r.category.toLowerCase()}|${r.division_id ?? ""}`;
  const current = useMemo(
    () => (rows.data ?? []).filter((r) => !r.valid_to || r.valid_to >= today),
    [rows.data, today],
  );
  const monthTotal = current
    .filter((r) => r.valid_from <= month)
    .reduce(
      (s, r) =>
        s + overheadMonthShare(r.amount_cents, r.frequency as Frequency, r.valid_from, month),
      0,
    );

  if (rows.error) return <FormMessage tone="error">{rows.error.message}</FormMessage>;
  if (rows.data && current.length === 0)
    return (
      <EmptyState
        title="Zatiaľ žiadny opakovaný náklad"
        description="Napr. nájom (mesačne), poistenie (ročne), účtovník (mesačne). Zmena sumy sa zadá ako nová verzia od mesiaca."
      />
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px]">
        Tento mesiac ({monthLabel(month)}):{" "}
        <span
          data-testid="recurring-month-total"
          className="text-navy text-[20px] font-semibold tabular-nums"
        >
          {formatMoney(monthTotal)}
        </span>
      </p>
      <ul className="flex flex-col divide-y divide-neutral-200" aria-label="Opakované náklady">
        {current.map((r) => {
          const versions = (rows.data ?? []).filter((x) => key(x) === key(r));
          const share = overheadMonthShare(
            r.amount_cents,
            r.frequency as Frequency,
            r.valid_from,
            month,
          );
          return (
            <li key={r.id} className="flex flex-col gap-2 py-3" data-testid="recurring-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.category}{" "}
                    <span className="text-[13px] font-normal text-neutral-700">
                      · {divisionName(r.division_id)}
                    </span>
                  </p>
                  <p className="text-[13px] text-neutral-700 tabular-nums">
                    {formatMoney(r.amount_cents)} {FREQUENCY_LABELS[r.frequency as Frequency]}
                    {r.frequency !== "monthly" && ` → ${formatMoney(share)} mesačne`} · od{" "}
                    {monthLabel(r.valid_from)}
                    {r.valid_to ? ` do ${monthLabel(r.valid_to)}` : " · trvalé"}
                    {r.note && ` · ${r.note}`}
                  </p>
                  {r.valid_from > today && (
                    <StatusBadge label="Platí od budúceho obdobia" tone="info" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <ReviewControl entityTable="recurring_overheads" entityId={r.id} />
                  <Button variant="ghost" onClick={() => setChange({ id: r.id, mode: "revise" })}>
                    Zmeniť sumu od…
                  </Button>
                  <Button variant="ghost" onClick={() => setChange({ id: r.id, mode: "end" })}>
                    Ukončiť k…
                  </Button>
                  {versions.length > 1 && (
                    <Button
                      variant="ghost"
                      aria-expanded={history === r.id}
                      onClick={() => setHistory(history === r.id ? null : r.id)}
                    >
                      História verzií ({versions.length})
                    </Button>
                  )}
                </div>
              </div>
              {change?.id === r.id && (
                <ChangeForm row={r} mode={change.mode} onDone={() => setChange(null)} />
              )}
              {history === r.id && (
                <ul
                  className="text-[13px] text-neutral-700 tabular-nums"
                  aria-label={`Verzie – ${r.category}`}
                >
                  {versions.map((v) => (
                    <li key={v.id}>
                      {formatDate(v.valid_from)} – {v.valid_to ? formatDate(v.valid_to) : "…"}:{" "}
                      {formatMoney(v.amount_cents)} {FREQUENCY_LABELS[v.frequency as Frequency]}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
