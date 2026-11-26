"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { Tile } from "@/ui/tile";
import { EmptyState } from "@/ui/empty-state";
import { useMachines, useSaveMachine, type Machine } from "../api";
import { machineSchema, type MachineInput, type MachineOutput } from "../schema";

const FIELDS: { name: keyof MachineInput; label: string }[] = [
  { name: "manufacturer", label: "Výrobca" },
  { name: "model", label: "Model" },
  { name: "serial_number", label: "Výrobné číslo" },
  { name: "year_built", label: "Rok výroby" },
  { name: "control_system", label: "Riadiaci systém" },
  { name: "location", label: "Umiestnenie" },
  { name: "note", label: "Poznámka" },
];

const toInput = (m: Machine | null): MachineInput => ({
  manufacturer: m?.manufacturer ?? "",
  model: m?.model ?? "",
  serial_number: m?.serial_number ?? "",
  year_built: m?.year_built == null ? "" : String(m.year_built),
  control_system: m?.control_system ?? "",
  location: m?.location ?? "",
  note: m?.note ?? "",
});

function MachineForm({
  customerId,
  machine,
  onDone,
}: {
  customerId: string;
  machine: Machine | null;
  onDone: () => void;
}) {
  const save = useSaveMachine(customerId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MachineInput, unknown, MachineOutput>({
    resolver: zodResolver(machineSchema),
    defaultValues: toInput(machine),
  });
  const submit = handleSubmit(async (values) => {
    const ok = await save
      .mutateAsync({ id: machine?.id ?? null, values })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });
  return (
    <form onSubmit={submit} noValidate aria-label="Stroj" className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FIELDS.map((f) => {
          const id = `machine-${machine?.id ?? "new"}-${f.name}`;
          const err = errors[f.name]?.message;
          return (
            <Field key={f.name} id={id} label={f.label} error={err}>
              <Input
                id={id}
                invalid={!!err}
                aria-describedby={describedBy(id, { error: err })}
                {...register(f.name)}
              />
            </Field>
          );
        })}
      </div>
      {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Uložiť stroj
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </form>
  );
}

/** Customer machines – only rendered when the feature flag service_cnc is on. */
export function MachinesTile({ customerId }: { customerId: string }) {
  const machines = useMachines(customerId, true);
  const [editing, setEditing] = useState<Machine | "new" | null>(null);
  return (
    <Tile
      size="M"
      title="Stroje (servis CNC)"
      className="md:row-span-2"
      action={
        editing === null ? (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            Pridať stroj
          </Button>
        ) : undefined
      }
    >
      {editing !== null ? (
        <MachineForm
          customerId={customerId}
          machine={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : machines.data?.length === 0 ? (
        <EmptyState title="Bez strojov" />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200">
          {(machines.data ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {[m.manufacturer, m.model].filter(Boolean).join(" ") || "Stroj"}
                {m.serial_number && (
                  <span className="text-[13px] text-neutral-700"> · v. č. {m.serial_number}</span>
                )}
              </span>
              <Button variant="ghost" onClick={() => setEditing(m)}>
                Upraviť
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
