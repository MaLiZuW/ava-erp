"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { Tile } from "@/ui/tile";
import { useDeleteUnit, useSaveUnit, useUnits } from "../api";
import { unitSchema, type UnitInput } from "../schema";

export function UnitsTab() {
  const units = useUnits();
  const save = useSaveUnit();
  const del = useDeleteUnit();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: { code: "", name: "" },
  });

  const submit = handleSubmit(async (v) => {
    const ok = await save
      .mutateAsync({ isNew: true, code: v.code, name: v.name })
      .then(() => true)
      .catch(() => false);
    if (ok) reset();
  });

  return (
    <Tile size="L" title="Merné jednotky" className="md:row-span-3">
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-neutral-200">
          {(units.data ?? []).map((u) => (
            <li key={u.code} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium tabular-nums">{u.code}</span>
                <span className="text-neutral-700"> – {u.name}</span>
              </span>
              <Button
                variant="ghost"
                disabled={del.isPending}
                onClick={() => del.mutate(u.code)}
                aria-label={`Zmazať jednotku ${u.code}`}
              >
                Zmazať
              </Button>
            </li>
          ))}
        </ul>
        {del.error && <FormMessage tone="error">{del.error.message}</FormMessage>}
        <form
          onSubmit={submit}
          noValidate
          aria-label="Nová jednotka"
          className="flex flex-wrap items-end gap-3"
        >
          <Field id="unit-code" label="Kód" error={errors.code?.message} className="w-32">
            <Input
              id="unit-code"
              invalid={!!errors.code}
              aria-describedby={describedBy("unit-code", { error: errors.code?.message })}
              {...register("code")}
            />
          </Field>
          <Field
            id="unit-name"
            label="Názov"
            error={errors.name?.message}
            className="min-w-40 flex-1"
          >
            <Input
              id="unit-name"
              invalid={!!errors.name}
              aria-describedby={describedBy("unit-name", { error: errors.name?.message })}
              {...register("name")}
            />
          </Field>
          <Button type="submit" disabled={isSubmitting}>
            Pridať jednotku
          </Button>
        </form>
        {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
        <p className="text-[13px] text-neutral-700">
          Jednotku, ktorá sa už používa v katalógu, databáza nedovolí zmazať.
        </p>
      </div>
    </Tile>
  );
}
