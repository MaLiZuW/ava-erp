"use client";

import { ReviewControl } from "@/core/data-review";
import { CalendarOff, ChevronLeft, ChevronRight, Minus, Plus, Sun } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { formatDate, parseDate, parseDecimal } from "@/core/format";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { Field, FormMessage, Input, Select } from "@/ui/field";
import { DateInput } from "@/ui/inputs";
import { NumberStepper } from "@/ui/number-stepper";
import { StatusBadge } from "@/ui/status-badge";
import { SettingsTile } from "../settings-tile";
import {
  EXCEPTION_KINDS,
  hoursText,
  monthEnd,
  monthGrid,
  monthStart,
  orderRange,
  sumHours,
  WEEKDAYS,
  weekStart,
  weekdayIndex,
  addDays,
  type ExceptionKind,
  type WeekdayKey,
} from "../../capacity";
import {
  useCapacityRange,
  useDeleteException,
  useExceptions,
  useSaveException,
  useSavePattern,
  useUserResources,
  useWorkPatterns,
  type CapacityDay,
  type WorkPattern,
} from "../../reporting-api";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const hoursInput = (n: number | string) => String(Number(n)).replace(".", ",");

/** Weekly pattern Mon–Sun (7 × NumberStepper, 0,5 h) saved as a new version from a date. */
function PatternEditor({ resourceId, patterns }: { resourceId: string; patterns: WorkPattern[] }) {
  const today = todayIso();
  const current =
    patterns.find((p) => p.valid_from <= today && (!p.valid_to || p.valid_to >= today)) ??
    patterns[0];
  const [hours, setHours] = useState<Record<WeekdayKey, string>>(
    () =>
      Object.fromEntries(
        WEEKDAYS.map((d) => [
          d.key,
          current ? hoursInput(current[d.key]) : d.key === "sat" || d.key === "sun" ? "0" : "8",
        ]),
      ) as Record<WeekdayKey, string>,
  );
  const [from, setFrom] = useState(formatDate(today));
  const save = useSavePattern();
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    setProblem(null);
    const validFrom = parseDate(from);
    if (!validFrom) return setProblem("Zadajte dátum „platí od“ v tvare DD/MM/YYYY.");
    const parsed: Record<string, number> = {};
    for (const d of WEEKDAYS) {
      const n = parseDecimal(hours[d.key] || "0", 2);
      if (n == null || n > 24) return setProblem(`${d.label}: zadajte 0–24 hodín.`);
      parsed[d.key] = n;
    }
    save.mutate({ resourceId, validFrom, hours: parsed });
  };
  const weekTotal = WEEKDAYS.reduce((s, d) => s + (parseDecimal(hours[d.key] || "0", 2) ?? 0), 0);

  return (
    <section aria-label="Týždenný vzor" className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
        Týždenný vzor
      </h3>
      {/* 7 columns only when there is room; 4 + 3 on a normal screen, 1 on a phone (point 18) */}
      <div className="grid grid-cols-1 gap-3 min-[1800px]:grid-cols-7 sm:grid-cols-2 lg:grid-cols-4">
        {WEEKDAYS.map((d) => (
          <div key={d.key} className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-neutral-700">{d.label}</span>
            <NumberStepper
              label={`Hodiny – ${d.label}`}
              unit="hod"
              max={24}
              decimals={2}
              suffix="h"
              value={hours[d.key]}
              onChange={(v) => setHours((h) => ({ ...h, [d.key]: v }))}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field id="pattern-from" label="Platí od" className="w-40">
          <DateInput id="pattern-from" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? "Ukladám…" : "Uložiť vzor"}
        </Button>
        <span className="h-10 text-[15px] leading-10 text-neutral-700 tabular-nums">
          Spolu {hoursText(weekTotal)} týždenne
        </span>
        {current && <ReviewControl entityTable="work_patterns" entityId={current.id} />}
      </div>
      {(problem || save.error) && (
        <FormMessage tone="error">{problem ?? save.error?.message}</FormMessage>
      )}
      {save.isSuccess && (
        <FormMessage tone="success">Vzor je uložený ako verzia od {from}.</FormMessage>
      )}
      {patterns.length > 0 && (
        <ul aria-label="Verzie vzoru" className="flex flex-col text-[13px] text-neutral-700">
          {patterns.map((p) => (
            <li key={p.id} className="tabular-nums">
              {formatDate(p.valid_from)} – {p.valid_to ? formatDate(p.valid_to) : "…"}:{" "}
              {WEEKDAYS.map((d) => `${d.short} ${hoursInput(p[d.key])}`).join(" · ")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DayCell({
  day,
  cap,
  selected,
  onPick,
}: {
  day: string;
  cap: CapacityDay | undefined;
  selected: boolean;
  onPick: (day: string, e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const d = Number(day.slice(8));
  const weekend = weekdayIndex(day) >= 5;
  const marks: string[] = [];
  if (cap?.is_day_off) marks.push(`Sviatok: ${cap.holiday_name}`);
  if (cap?.is_absent) marks.push("Dovolenka / nedostupnosť");
  if (cap && cap.other_work > 0) marks.push(`Iná práca −${hoursText(cap.other_work)}`);
  if (cap && cap.extra > 0) marks.push(`Extra +${hoursText(cap.extra)}`);
  const label = `${formatDate(day)}: ${cap ? hoursText(cap.available_hours) : "…"}${marks.length ? ` – ${marks.join(", ")}` : ""}`;
  return (
    <button
      type="button"
      data-day={day}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={(e) => onPick(day, e)}
      className={cn(
        "flex h-20 w-full flex-col items-start justify-between rounded-xl border p-2 text-left transition-colors duration-150 ease-out",
        selected ? "border-navy ring-navy ring-2" : "hover:bg-canvas border-neutral-200",
        weekend && !selected && "bg-canvas/60",
      )}
    >
      <span className="flex w-full items-center justify-between text-[13px] font-semibold tabular-nums">
        {d}
        <span className="flex gap-0.5 text-neutral-700">
          {cap?.is_day_off && <Sun aria-hidden className="size-3.5" />}
          {cap?.is_absent && <CalendarOff aria-hidden className="size-3.5" />}
          {cap && cap.other_work > 0 && <Minus aria-hidden className="size-3.5" />}
          {cap && cap.extra > 0 && <Plus aria-hidden className="size-3.5" />}
        </span>
      </span>
      <span className="text-navy text-[15px] font-semibold tabular-nums">
        {cap ? hoursText(cap.available_hours) : "…"}
      </span>
      {(cap?.is_day_off || cap?.is_absent) && (
        <span className="w-full truncate text-[11px] leading-4 text-neutral-700">
          {cap?.is_absent ? "Neprítomný" : "Sviatok"}
        </span>
      )}
    </button>
  );
}

function ExceptionForm({
  resourceId,
  range,
  onDone,
}: {
  resourceId: string;
  range: [string, string];
  onDone: () => void;
}) {
  const save = useSaveException();
  const [kind, setKind] = useState<ExceptionKind>("vacation");
  const [hours, setHours] = useState("1");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const needsHours = EXCEPTION_KINDS[kind].needsHours;

  const submit = async () => {
    setProblem(null);
    const h = needsHours ? parseDecimal(hours, 2) : null;
    if (needsHours && (h == null || h <= 0 || h > 24)) return setProblem("Zadajte 0,5–24 hodín.");
    const ok = await save
      .mutateAsync({
        resource_id: resourceId,
        date_from: range[0],
        date_to: range[1],
        kind,
        hours: h,
        note: note.trim() || null,
      })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  };

  return (
    <section
      aria-label="Nová výnimka"
      className="bg-canvas/50 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4"
    >
      <p className="text-[15px] font-medium">
        Výnimka{" "}
        {range[0] === range[1]
          ? formatDate(range[0])
          : `${formatDate(range[0])} – ${formatDate(range[1])}`}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field id="exception-kind" label="Typ" hint={EXCEPTION_KINDS[kind].hint}>
          <Select
            id="exception-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ExceptionKind)}
          >
            {Object.entries(EXCEPTION_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        {needsHours && (
          <Field id="exception-hours" label="Hodiny za deň">
            <NumberStepper
              id="exception-hours"
              label="Hodiny za deň"
              unit="hod"
              min={0.5}
              max={24}
              decimals={2}
              suffix="h"
              value={hours}
              onChange={setHours}
            />
          </Field>
        )}
        <Field
          id="exception-note"
          label="Poznámka"
          hint="Len všeobecný dôvod (napr. školenie, služobná cesta) – nikdy zdravotné údaje."
        >
          <Input
            id="exception-note"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      {(problem || save.error) && (
        <FormMessage tone="error">{problem ?? save.error?.message}</FormMessage>
      )}
      <div className="flex gap-2">
        <Button onClick={() => void submit()} disabled={save.isPending}>
          Pridať výnimku
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </section>
  );
}

/**
 * Capacity of a person: weekly pattern + calendar exceptions + Slovak days of rest (D24).
 * Work on jobs is never entered here – from F5a task assignments subtract it.
 */
export function CapacityCalendarTile() {
  const people = useUserResources();
  const [personId, setPersonId] = useState<string>("");
  const resourceId = personId || people.data?.[0]?.id || null;
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const from = monthStart(ym.y, ym.m);
  const to = monthEnd(ym.y, ym.m);
  const grid = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const viewFrom = weekStart(from);
  const viewTo = addDays(weekStart(to), 6);
  const patterns = useWorkPatterns(resourceId);
  const capacity = useCapacityRange(resourceId, viewFrom, viewTo);
  const exceptions = useExceptions(resourceId, from, to);
  const del = useDeleteException();
  const [sel, setSel] = useState<[string, string] | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const byDay = useMemo(
    () => new Map((capacity.data ?? []).map((c) => [c.day, c])),
    [capacity.data],
  );

  const pick = (day: string, e: MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey && anchor) setSel(orderRange(anchor, day));
    else {
      setAnchor(day);
      setSel([day, day]);
    }
  };
  const shiftMonth = (delta: number) => {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setSel(null);
  };
  const selWeek = weekStart(sel?.[0] ?? todayIso());
  const monthTotal = sumHours(capacity.data ?? [], from, to);
  const weekTotal = sumHours(capacity.data ?? [], selWeek, addDays(selWeek, 6));

  return (
    <SettingsTile size="XL" title="Kapacity – kalendár">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field id="capacity-person" label="Osoba" className="w-64">
            <Select
              id="capacity-person"
              value={resourceId ?? ""}
              onChange={(e) => setPersonId(e.target.value)}
            >
              {(people.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="max-w-prose text-[13px] text-neutral-700">
            Dostupné hodiny = týždenný vzor − dni pracovného pokoja ± výnimky. Práca na zákazkách sa
            tu nezadáva – od fázy 5a ju odpočítajú priradené úlohy.
          </p>
        </div>

        {resourceId && patterns.data && (
          <PatternEditor
            key={resourceId} // not by version: a save must not reset the form and its message
            resourceId={resourceId}
            patterns={patterns.data}
          />
        )}

        <section aria-label="Mesačný kalendár" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                aria-label="Predchádzajúci mesiac"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <span
                className="text-navy w-24 text-center text-[20px] font-semibold tabular-nums"
                data-testid="capacity-month"
              >
                {String(ym.m).padStart(2, "0")}/{ym.y}
              </span>
              <Button
                variant="secondary"
                aria-label="Nasledujúci mesiac"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={`Mesiac ${hoursText(monthTotal)}`} tone="info" />
              <StatusBadge label={`Týždeň od ${formatDate(selWeek)}: ${hoursText(weekTotal)}`} />
            </div>
          </div>
          <p className="text-[13px] text-neutral-700">
            Kliknite na deň, so Shift+klik vyberiete obdobie. Značky: slnko = deň pracovného pokoja,
            prečiarknutý kalendár = neprítomnosť, − iná práca, + extra hodiny.
          </p>
          {capacity.error && <FormMessage tone="error">{capacity.error.message}</FormMessage>}
          <table className="w-full table-fixed border-separate border-spacing-1">
            <caption className="sr-only">Dostupné hodiny po dňoch</caption>
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th
                    key={d.key}
                    scope="col"
                    className="text-[13px] font-semibold text-neutral-500"
                  >
                    <abbr title={d.label} className="no-underline">
                      {d.short}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((week, i) => (
                <tr key={i}>
                  {week.map((day, j) => (
                    <td key={j} className="align-top">
                      {day && (
                        <DayCell
                          day={day}
                          cap={byDay.get(day)}
                          selected={!!sel && day >= sel[0] && day <= sel[1]}
                          onPick={pick}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {resourceId && sel && (
          <ExceptionForm
            key={`${sel[0]}-${sel[1]}`}
            resourceId={resourceId}
            range={sel}
            onDone={() => setSel(null)}
          />
        )}

        <section aria-label="Výnimky v mesiaci" className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
            Výnimky v mesiaci
          </h3>
          {del.error && <FormMessage tone="error">{del.error.message}</FormMessage>}
          {exceptions.data?.length === 0 ? (
            <p className="text-[15px] text-neutral-700">Žiadne výnimky.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-200">
              {(exceptions.data ?? []).map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="tabular-nums">
                    {formatDate(x.date_from)}
                    {x.date_to !== x.date_from && ` – ${formatDate(x.date_to)}`} ·{" "}
                    {EXCEPTION_KINDS[x.kind as ExceptionKind]?.label ?? x.kind}
                    {x.hours != null && ` · ${hoursText(Number(x.hours))}`}
                    {x.note && <span className="text-neutral-700"> · {x.note}</span>}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={del.isPending}
                    onClick={() => del.mutate(x.id)}
                    aria-label={`Zmazať výnimku od ${formatDate(x.date_from)}`}
                  >
                    Zmazať
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SettingsTile>
  );
}
