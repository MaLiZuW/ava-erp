"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { formatMoney, formatMoneyInput } from "@/core/format";
import { useDivisions } from "@/core/shared-queries";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { describedBy, Field, FormMessage, Input, Select } from "@/ui/field";
import { MoneyInput } from "@/ui/inputs";
import { Tile } from "@/ui/tile";
import {
  monthOptions,
  overheadSchema,
  type OverheadInput,
  type OverheadOutput,
} from "../../reporting";
import {
  useDeleteOverhead,
  useOverhead,
  useSaveOverhead,
  type OverheadRow,
} from "../../reporting-api";

function OverheadForm({
  month,
  row,
  onDone,
}: {
  month: string;
  row: OverheadRow | null;
  onDone: () => void;
}) {
  const save = useSaveOverhead();
  const divisions = useDivisions();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OverheadInput, unknown, OverheadOutput>({
    resolver: zodResolver(overheadSchema),
    defaultValues: {
      category: row?.category ?? "",
      division_id: row?.division_id ?? "",
      amount_cents: row ? formatMoneyInput(row.amount_cents) : "",
      note: row?.note ?? "",
    },
  });
  const submit = handleSubmit(async (values) => {
    const ok = await save
      .mutateAsync({ id: row?.id ?? null, month, values })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={row ? "Úprava réžie" : "Nová položka réžie"}
      className="bg-canvas/50 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 p-4 md:grid-cols-4"
    >
      <Field
        id="overhead-category"
        label="Kategória"
        error={errors.category?.message}
        className="md:col-span-2"
      >
        <Input
          id="overhead-category"
          invalid={!!errors.category}
          aria-describedby={describedBy("overhead-category", { error: errors.category?.message })}
          {...register("category")}
        />
      </Field>
      <Field id="overhead-division" label="Divízia">
        <Select id="overhead-division" {...register("division_id")}>
          <option value="">Spoločná (celá firma)</option>
          {(divisions.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="overhead-amount" label="Suma za mesiac" error={errors.amount_cents?.message}>
        <MoneyInput
          id="overhead-amount"
          invalid={!!errors.amount_cents}
          aria-describedby={describedBy("overhead-amount", { error: errors.amount_cents?.message })}
          {...register("amount_cents")}
        />
      </Field>
      <Field id="overhead-note" label="Poznámka" className="md:col-span-4">
        <Input id="overhead-note" {...register("note")} />
      </Field>
      {save.error && (
        <div className="md:col-span-4">
          <FormMessage tone="error">{save.error.message}</FormMessage>
        </div>
      )}
      <div className="flex gap-2 md:col-span-4">
        <Button type="submit" disabled={isSubmitting}>
          Uložiť
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </form>
  );
}

/** Monthly fixed costs (BUSINESS_PROCESSES.md 12.2 "Réžia"), optionally split by division. */
export function OverheadTile() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[12].value); // current month
  const [editing, setEditing] = useState<OverheadRow | "new" | null>(null);
  const rows = useOverhead(month);
  const del = useDeleteOverhead();
  const divisions = useDivisions();
  const divisionName = (id: string | null) =>
    id ? (divisions.data?.find((d) => d.id === id)?.name ?? "—") : "Spoločná";
  const total = (rows.data ?? []).reduce((s, r) => s + r.amount_cents, 0);

  return (
    <Tile
      size="XL"
      title="Réžia – mesačné fixné náklady"
      action={
        editing === null ? (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            Pridať náklad
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field id="overhead-month" label="Mesiac" className="w-40">
            <Select
              id="overhead-month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setEditing(null);
              }}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-[15px]">
            Spolu za mesiac:{" "}
            <span
              data-testid="overhead-total"
              className="text-navy text-[20px] font-semibold tabular-nums"
            >
              {formatMoney(total)}
            </span>
          </p>
        </div>
        {editing !== null && (
          <OverheadForm
            key={editing === "new" ? `new-${month}` : editing.id}
            month={month}
            row={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
        {rows.error && <FormMessage tone="error">{rows.error.message}</FormMessage>}
        {del.error && <FormMessage tone="error">{del.error.message}</FormMessage>}
        {rows.data?.length === 0 ? (
          <EmptyState
            title="Bez réžie v tomto mesiaci"
            description="Napr. nájom, účtovník, telefóny, softvér, poistenie."
          />
        ) : (
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">Réžia za mesiac</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
                <th scope="col" className="h-10 pr-3">
                  Kategória
                </th>
                <th scope="col" className="px-3">
                  Divízia
                </th>
                <th scope="col" className="px-3 text-right">
                  Suma
                </th>
                <th scope="col">
                  <span className="sr-only">Akcie</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(rows.data ?? []).map((r) => (
                <tr key={r.id} className="h-12 border-b border-neutral-200">
                  <td className="pr-3">
                    {r.category}
                    {r.note && <span className="block text-[13px] text-neutral-700">{r.note}</span>}
                  </td>
                  <td className="px-3">{divisionName(r.division_id)}</td>
                  <td className="px-3 text-right tabular-nums">{formatMoney(r.amount_cents)}</td>
                  <td className="text-right whitespace-nowrap">
                    <Button variant="ghost" onClick={() => setEditing(r)}>
                      Upraviť
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={del.isPending}
                      onClick={() => del.mutate(r.id)}
                      aria-label={`Zmazať ${r.category}`}
                    >
                      Zmazať
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Tile>
  );
}
