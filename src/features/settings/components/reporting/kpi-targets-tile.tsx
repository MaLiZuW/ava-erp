"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { formatDate, formatMoney, formatMoneyInput } from "@/core/format";
import { useDivisions } from "@/core/shared-queries";
import { Button } from "@/ui/button";
import { ChipGroup } from "@/ui/chips";
import { describedBy, Field, FormMessage, Select } from "@/ui/field";
import { DateInput, SuffixInput } from "@/ui/inputs";
import { SettingsTile } from "../settings-tile";
import {
  DIRECTION_LABELS,
  KPI_DEFINITIONS,
  kpiTargetSchema,
  UNIT_SUFFIX,
  type KpiDefinition,
  type KpiTargetInput,
} from "../../reporting";
import {
  currentTarget,
  useDeleteKpiTarget,
  useKpiTargets,
  useSaveKpiTarget,
  type KpiTarget,
} from "../../reporting-api";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Display of a stored KPI value: €/h is stored in cents. */
export function formatKpiValue(def: KpiDefinition, value: number | null | undefined): string {
  if (value == null) return "—";
  if (def.unit === "money_per_hour") return `${formatMoney(Number(value))}/h`;
  return `${String(Number(value)).replace(".", ",")} ${UNIT_SUFFIX[def.unit]}`;
}

const toFormValue = (def: KpiDefinition, value: number | null | undefined) =>
  value == null
    ? ""
    : def.unit === "money_per_hour"
      ? formatMoneyInput(Number(value))
      : String(Number(value)).replace(".", ",");

function TargetForm({
  def,
  divisionId,
  current,
  all,
  onDone,
}: {
  def: KpiDefinition;
  divisionId: string | null;
  current: KpiTarget | undefined;
  all: readonly KpiTarget[];
  onDone: () => void;
}) {
  const save = useSaveKpiTarget();
  const schema = useMemo(() => kpiTargetSchema(def.unit), [def.unit]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<KpiTargetInput, unknown, ReturnType<typeof schema.parse>>({
    resolver: zodResolver(schema),
    defaultValues: {
      target_value: toFormValue(def, current?.target_value),
      warning_value: toFormValue(def, current?.warning_value),
      direction:
        current?.direction === "higher_better" || current?.direction === "lower_better"
          ? current.direction
          : def.direction,
      valid_from: formatDate(todayIso()),
    },
  });
  const submit = handleSubmit(async (v) => {
    // a new validity date = new row (history); the same date = correction of that row
    const same = all.find(
      (r) => r.kpi_key === def.key && r.division_id === divisionId && r.valid_from === v.valid_from,
    );
    const ok = await save
      .mutateAsync({
        id: same?.id ?? null,
        row: {
          kpi_key: def.key,
          division_id: divisionId,
          target_value: v.target_value!,
          warning_value: v.warning_value,
          direction: v.direction,
          valid_from: v.valid_from,
        },
      })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });
  const suffix = UNIT_SUFFIX[def.unit];
  const base = `kpi-${def.key}`;
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={`Cieľ – ${def.label}`}
      className="bg-canvas/50 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 p-4 md:grid-cols-4"
    >
      <Field id={`${base}-target`} label="Cieľ" error={errors.target_value?.message}>
        <SuffixInput
          suffix={suffix}
          inputMode="decimal"
          id={`${base}-target`}
          invalid={!!errors.target_value}
          aria-describedby={describedBy(`${base}-target`, { error: errors.target_value?.message })}
          {...register("target_value")}
        />
      </Field>
      <Field
        id={`${base}-warning`}
        label="Hranica upozornenia"
        hint="Nepovinné – žltý semafor."
        error={errors.warning_value?.message}
      >
        <SuffixInput
          suffix={suffix}
          inputMode="decimal"
          id={`${base}-warning`}
          invalid={!!errors.warning_value}
          aria-describedby={describedBy(`${base}-warning`, {
            hint: "Nepovinné – žltý semafor.",
            error: errors.warning_value?.message,
          })}
          {...register("warning_value")}
        />
      </Field>
      <Field id={`${base}-direction`} label="Smer">
        <Select id={`${base}-direction`} {...register("direction")}>
          {Object.entries(DIRECTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${base}-from`} label="Platí od" error={errors.valid_from?.message}>
        <DateInput
          id={`${base}-from`}
          invalid={!!errors.valid_from}
          aria-describedby={describedBy(`${base}-from`, { error: errors.valid_from?.message })}
          {...register("valid_from")}
        />
      </Field>
      {save.error && (
        <div className="md:col-span-4">
          <FormMessage tone="error">{save.error.message}</FormMessage>
        </div>
      )}
      <div className="flex gap-2 md:col-span-4">
        <Button type="submit" disabled={isSubmitting}>
          Uložiť cieľ
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </form>
  );
}

/** Targets of the process KPIs (BUSINESS_PROCESSES.md chapter 14) for Spolu / AVENG / Agentúra. */
export function KpiTargetsTile() {
  const divisions = useDivisions();
  const targets = useKpiTargets();
  const del = useDeleteKpiTarget();
  const [scope, setScope] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const divisionId = scope === "all" ? null : scope;
  const today = todayIso();
  const rows = targets.data ?? [];

  return (
    <SettingsTile size="XL" title="Ciele procesných KPI">
      <div className="flex flex-col gap-4">
        <ChipGroup
          label="Pre"
          options={[
            { value: "all", label: "Spolu" },
            ...(divisions.data ?? []).map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={scope}
          onChange={(v) => {
            setScope(v);
            setEditing(null);
          }}
        />
        {targets.error && <FormMessage tone="error">{targets.error.message}</FormMessage>}
        {del.error && <FormMessage tone="error">{del.error.message}</FormMessage>}
        <ul className="flex flex-col divide-y divide-neutral-200">
          {KPI_DEFINITIONS.map((def) => {
            const cur = currentTarget(rows, def.key, divisionId, today);
            const future = rows.filter(
              (r) => r.kpi_key === def.key && r.division_id === divisionId && r.valid_from > today,
            );
            return (
              <li key={def.key} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {def.label}
                      {def.link && (
                        <span className="text-[13px] text-neutral-500"> · {def.link}</span>
                      )}
                    </p>
                    <p className="text-[13px] text-neutral-700 tabular-nums">
                      {cur
                        ? `Cieľ ${formatKpiValue(def, cur.target_value)} · upozornenie ${formatKpiValue(def, cur.warning_value)} · ${
                            DIRECTION_LABELS[cur.direction as keyof typeof DIRECTION_LABELS] ??
                            cur.direction
                          } · od ${formatDate(cur.valid_from)}`
                        : "Cieľ nie je nastavený."}
                      {future.length > 0 &&
                        ` · plánovaná zmena od ${formatDate(future[future.length - 1].valid_from)}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {cur && (
                      <Button
                        variant="ghost"
                        disabled={del.isPending}
                        onClick={() => del.mutate(cur.id)}
                        aria-label={`Zmazať cieľ ${def.label}`}
                      >
                        Zmazať
                      </Button>
                    )}
                    {editing !== def.key && (
                      <Button
                        variant="secondary"
                        onClick={() => setEditing(def.key)}
                        aria-label={`Nastaviť cieľ ${def.label}`}
                      >
                        Nastaviť
                      </Button>
                    )}
                  </div>
                </div>
                {editing === def.key && (
                  <TargetForm
                    key={`${def.key}-${scope}`}
                    def={def}
                    divisionId={divisionId}
                    current={cur}
                    all={rows}
                    onDone={() => setEditing(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </SettingsTile>
  );
}
