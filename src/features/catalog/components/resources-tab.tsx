"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { resourceCostRateCents } from "@/core/calc/resource-rate";
import { formatMoney, formatMoneyInput, parseDecimal, parseMoneyToCents } from "@/core/format";
import { Button } from "@/ui/button";
import { ChipGroup } from "@/ui/chips";
import { DataTable, type Column } from "@/ui/data-table";
import { EmptyState } from "@/ui/empty-state";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { MoneyInput } from "@/ui/inputs";
import { NumberStepper } from "@/ui/number-stepper";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import { useResources, useSaveResource, useSetResourceActive, type Resource } from "../api";
import { RESOURCE_KINDS, resourceSchema, type ResourceInput, type ResourceOutput } from "../schema";

const toInput = (r: Resource | null): ResourceInput => ({
  name: r?.name ?? "",
  kind: r?.kind ?? "",
  purchase_cost_cents: formatMoneyInput(r?.purchase_cost_cents ?? 0),
  expected_life_hours: r ? String(r.expected_life_hours).replace(".", ",") : "",
  operating_cost_per_hour_cents: formatMoneyInput(r?.operating_cost_per_hour_cents ?? 0),
  bill_rate_cents: r?.bill_rate_cents == null ? "" : formatMoneyInput(r.bill_rate_cents),
});

function ResourceForm({ resource, onDone }: { resource: Resource | null; onDone: () => void }) {
  const save = useSaveResource();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResourceInput, unknown, ResourceOutput>({
    resolver: zodResolver(resourceSchema),
    defaultValues: toInput(resource),
  });
  const [purchase, hours, operating] = useWatch({
    control,
    name: ["purchase_cost_cents", "expected_life_hours", "operating_cost_per_hour_cents"],
  });
  // live preview with the same formula as the database (generated column)
  const p = parseMoneyToCents(purchase ?? "");
  const h = parseDecimal(hours ?? "", 2);
  const o = parseMoneyToCents(operating ?? "");
  const preview = p != null && h != null && o != null ? resourceCostRateCents(p, h, o) : null;

  const submit = handleSubmit(async (values) => {
    const ok = await save
      .mutateAsync({ id: resource?.id ?? null, values })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });
  const formId = "resource-form";
  const id = (n: keyof ResourceInput) => `${formId}-${n}`;
  const err = (n: keyof ResourceInput) => errors[n]?.message;

  return (
    <Tile
      size="XL"
      title={resource ? `Technika – ${resource.name}` : "Nová technika"}
      action={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Zrušiť
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? "Ukladám…" : "Uložiť"}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={submit}
        noValidate
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <Field id={id("name")} label="Názov" error={err("name")} className="md:col-span-2">
          <Input
            id={id("name")}
            invalid={!!err("name")}
            aria-describedby={describedBy(id("name"), { error: err("name") })}
            {...register("name")}
          />
        </Field>
        <Field id={id("kind")} label="Druh" hint={RESOURCE_KINDS.join(", ")} error={err("kind")}>
          <Input id={id("kind")} list="resource-kinds" {...register("kind")} />
        </Field>
        <datalist id="resource-kinds">
          {RESOURCE_KINDS.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <Field
          id={id("bill_rate_cents")}
          label="Predajná sadzba / h"
          hint="Nepovinné."
          error={err("bill_rate_cents")}
        >
          <MoneyInput
            id={id("bill_rate_cents")}
            invalid={!!err("bill_rate_cents")}
            {...register("bill_rate_cents")}
          />
        </Field>
        <Field
          id={id("purchase_cost_cents")}
          label="Obstarávacia cena"
          error={err("purchase_cost_cents")}
        >
          <MoneyInput
            id={id("purchase_cost_cents")}
            invalid={!!err("purchase_cost_cents")}
            aria-describedby={describedBy(id("purchase_cost_cents"), {
              error: err("purchase_cost_cents"),
            })}
            {...register("purchase_cost_cents")}
          />
        </Field>
        <Field
          id={id("expected_life_hours")}
          label="Predpokladaná životnosť"
          error={err("expected_life_hours")}
        >
          <Controller
            control={control}
            name="expected_life_hours"
            render={({ field }) => (
              <NumberStepper
                id={id("expected_life_hours")}
                label="Predpokladaná životnosť"
                suffix="h"
                step={100} // owner's choice: 100 h, Shift = 1000 h
                decimals={2}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                invalid={!!err("expected_life_hours")}
                aria-describedby={describedBy(id("expected_life_hours"), {
                  error: err("expected_life_hours"),
                })}
              />
            )}
          />
        </Field>
        <Field
          id={id("operating_cost_per_hour_cents")}
          label="Prevádzkové náklady / h"
          error={err("operating_cost_per_hour_cents")}
        >
          <MoneyInput
            id={id("operating_cost_per_hour_cents")}
            invalid={!!err("operating_cost_per_hour_cents")}
            {...register("operating_cost_per_hour_cents")}
          />
        </Field>
        <div className="flex flex-col justify-end">
          <p className="text-[13px] font-medium text-neutral-700">Nákladová sadzba / h</p>
          <p
            data-testid="resource-rate-preview"
            className="text-navy text-[20px] leading-7 font-semibold tabular-nums"
          >
            {preview == null ? "—" : formatMoney(preview)}
          </p>
          <p className="text-[13px] text-neutral-500">
            cena ÷ hodiny + prevádzka (kalkulačné opotrebenie)
          </p>
        </div>
        {save.error && (
          <div className="md:col-span-2 xl:col-span-4">
            <FormMessage tone="error">{save.error.message}</FormMessage>
          </div>
        )}
      </form>
    </Tile>
  );
}

export function ResourcesTab({ openNew = false }: { openNew?: boolean }) {
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Resource | "new" | null>(openNew ? "new" : null);
  const resources = useResources(showInactive);
  const setActive = useSetResourceActive();

  const columns: Column<Resource>[] = [
    {
      key: "name",
      header: "Názov",
      cell: (r) => (
        <button
          type="button"
          className="text-navy text-left font-medium hover:underline"
          onClick={() => setEditing(r)}
        >
          {r.name}
        </button>
      ),
    },
    { key: "kind", header: "Druh", cell: (r) => r.kind ?? "—" },
    {
      key: "cost",
      header: "Nákladová / h",
      numeric: true,
      cell: (r) => formatMoney(r.cost_rate_cents),
    },
    {
      key: "bill",
      header: "Predajná / h",
      numeric: true,
      cell: (r) => (r.bill_rate_cents == null ? "—" : formatMoney(r.bill_rate_cents)),
    },
    {
      key: "state",
      header: "Stav",
      cell: (r) => (
        <span className="flex items-center gap-2">
          {r.is_active ? (
            <StatusBadge label="Aktívny" tone="success" />
          ) : (
            <StatusBadge label="Neaktívny" />
          )}
          <Button
            variant="ghost"
            className="h-8 px-2 text-[13px]"
            disabled={setActive.isPending}
            onClick={() => setActive.mutate({ id: r.id, is_active: !r.is_active })}
          >
            {r.is_active ? "Deaktivovať" : "Aktivovať"}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      {editing !== null && (
        <ResourceForm
          key={editing === "new" ? "new" : editing.id}
          resource={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      <Tile
        size="XL"
        title="Technika a vybavenie"
        action={
          editing === null ? (
            <Button onClick={() => setEditing("new")}>+ Nová technika</Button>
          ) : undefined
        }
      >
        <ChipGroup
          label="Zobraziť"
          className="mb-4"
          options={[
            { value: "active", label: "Aktívne" },
            { value: "all", label: "Všetky" },
          ]}
          value={showInactive ? "all" : "active"}
          onChange={(v) => setShowInactive(v === "all")}
        />
        {resources.error && <FormMessage tone="error">{resources.error.message}</FormMessage>}
        {setActive.error && <FormMessage tone="error">{setActive.error.message}</FormMessage>}
        <DataTable
          caption="Technika a vybavenie"
          columns={columns}
          rows={resources.data ?? []}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              title="Zatiaľ žiadna technika"
              description="Napr. plotter, vozidlo, ozvučenie – s nákladovou sadzbou na hodinu."
            />
          }
        />
      </Tile>
    </>
  );
}
