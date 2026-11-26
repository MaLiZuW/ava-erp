"use client";

import { useState } from "react";
import { parseDecimal } from "@/core/format";
import { useProfiles } from "@/core/shared-queries";
import { Field, FormMessage, Select } from "@/ui/field";
import { NumberStepper } from "@/ui/number-stepper";
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
  const check = (text: string) => {
    const n = text.trim() === "" ? null : parseDecimal(text, 2);
    return { n, invalid: text.trim() !== "" && (n == null || n > MAX_HOURS) };
  };
  const { invalid } = check(value);
  const commit = (text: string) => {
    const { n, invalid: bad } = check(text);
    if (n == null || bad || n === Number(row?.available_hours)) return;
    save.mutate({ userId, month, hours: n });
  };
  return (
    <div className="flex flex-col gap-1">
      <NumberStepper
        label={`Dostupné hodiny – ${label}`}
        suffix="h"
        unit="hod"
        max={MAX_HOURS}
        decimals={2}
        value={value}
        invalid={invalid}
        onChange={setValue}
        onStep={commit}
        onBlur={() => commit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(value);
        }}
        className="w-48"
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
