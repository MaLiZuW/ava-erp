"use client";

import { useState } from "react";
import { parseDecimal } from "@/core/format";
import { useProfiles } from "@/core/shared-queries";
import { Field, FormMessage, Select } from "@/ui/field";
import { SuffixInput } from "@/ui/inputs";
import { Tile } from "@/ui/tile";
import { monthOptions } from "../../reporting";
import { useCapacity, useSaveCapacity, type CapacityRow } from "../../reporting-api";

const MAX_HOURS = 744; // 31 days × 24 h

function HoursInput({
  userId,
  label,
  month,
  row,
}: {
  userId: string;
  label: string;
  month: string;
  row: CapacityRow | undefined;
}) {
  const save = useSaveCapacity();
  const [value, setValue] = useState(row ? String(row.available_hours).replace(".", ",") : "");
  const parsed = value.trim() === "" ? null : parseDecimal(value, 2);
  const invalid = value.trim() !== "" && (parsed == null || parsed > MAX_HOURS);
  const commit = () => {
    if (parsed == null || invalid || parsed === Number(row?.available_hours)) return;
    save.mutate({ userId, month, hours: parsed });
  };
  return (
    <div className="flex flex-col gap-1">
      <SuffixInput
        suffix="h"
        inputMode="decimal"
        aria-label={`Dostupné hodiny – ${label}`}
        value={value}
        invalid={invalid}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-32"
      />
      {invalid && <p className="text-danger text-[13px]">0–{MAX_HOURS} hodín.</p>}
      {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
      {save.isSuccess && <p className="text-success text-[13px]">Uložené.</p>}
    </div>
  );
}

/** Available hours per person and month – denominator of the utilisation KPI (S1). */
export function CapacityTile() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[12].value);
  const profiles = useProfiles();
  const capacity = useCapacity(month);

  return (
    <Tile size="L" title="Kapacity – dostupné hodiny" className="md:row-span-2">
      <div className="flex flex-col gap-4">
        <Field id="capacity-month" label="Mesiac" className="w-40">
          <Select id="capacity-month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        {capacity.error && <FormMessage tone="error">{capacity.error.message}</FormMessage>}
        <ul className="flex flex-col divide-y divide-neutral-200">
          {(profiles.data ?? []).map((p) => {
            const label = p.full_name || p.email || "Používateľ";
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span>{label}</span>
                {capacity.isPending ? (
                  <span aria-hidden className="bg-canvas h-10 w-32 animate-pulse rounded-xl" />
                ) : (
                  <HoursInput
                    key={`${p.id}-${month}`}
                    userId={p.id}
                    label={label}
                    month={month}
                    row={capacity.data?.find((c) => c.user_id === p.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-neutral-700">
          Uloží sa po opustení poľa alebo klávesom Enter.
        </p>
      </div>
    </Tile>
  );
}
