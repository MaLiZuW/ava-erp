"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { formatMoney, formatMoneyInput, formatPercent } from "@/core/format";
import { Button } from "@/ui/button";
import { ChipGroup } from "@/ui/chips";
import { DataTable, type Column } from "@/ui/data-table";
import { EmptyState } from "@/ui/empty-state";
import { describedBy, Field, FormMessage, Input, Select, Textarea } from "@/ui/field";
import { MoneyInput } from "@/ui/inputs";
import { NumberStepper } from "@/ui/number-stepper";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import {
  useCatalogItems,
  useDivisions,
  useSaveItem,
  useSetItemActive,
  useSupplierOptions,
  useUnits,
  type CatalogItem,
} from "../api";
import {
  ITEM_TYPE_LABELS,
  itemSchema,
  PRICING_MODE_LABELS,
  type ItemInput,
  type ItemOutput,
  type ItemType,
} from "../schema";

const HINT_CODE = "Nepovinné, napr. PRM-HRNCEK.";
const HINT_COST = "Posledná známa cena bez DPH.";

const toInput = (i: CatalogItem | null): ItemInput => ({
  code: i?.code ?? "",
  name: i?.name ?? "",
  item_type: i?.item_type ?? "goods",
  division_id: i?.division_id ?? "",
  unit_code: i?.unit_code ?? "ks",
  default_cost_cents: formatMoneyInput(i?.default_cost_cents ?? 0),
  default_supplier_id: i?.default_supplier_id ?? "",
  default_pricing_mode: i?.default_pricing_mode ?? "none",
  default_pricing_pct: formatPercent(i?.default_pricing_pct),
  description: i?.description ?? "",
});

export function ItemForm({ item, onDone }: { item: CatalogItem | null; onDone: () => void }) {
  const save = useSaveItem();
  const units = useUnits();
  const divisions = useDivisions();
  const suppliers = useSupplierOptions();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ItemInput, unknown, ItemOutput>({
    resolver: zodResolver(itemSchema),
    defaultValues: toInput(item),
  });
  const mode = useWatch({ control, name: "default_pricing_mode" });
  const pctHint =
    mode === "margin" ? "Cena = náklad ÷ (1 − marža)." : "Cena = náklad × (1 + prirážka).";
  const formId = "catalog-item-form";
  const id = (n: string) => `${formId}-${n}`;
  const err = (n: keyof ItemInput) => errors[n]?.message;

  const submit = handleSubmit(async (values) => {
    const ok = await save
      .mutateAsync({ id: item?.id ?? null, values })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });

  return (
    <Tile
      size="XL"
      title={item ? `Položka – ${item.name}` : "Nová položka katalógu"}
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
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field id={id("name")} label="Názov" error={err("name")} className="md:col-span-2">
            <Input
              id={id("name")}
              invalid={!!err("name")}
              aria-describedby={describedBy(id("name"), { error: err("name") })}
              {...register("name")}
            />
          </Field>
          <Field id={id("code")} label="Interný kód" hint={HINT_CODE} error={err("code")}>
            <Input
              id={id("code")}
              invalid={!!err("code")}
              aria-describedby={describedBy(id("code"), { hint: HINT_CODE, error: err("code") })}
              {...register("code")}
            />
          </Field>
          <Field id={id("item_type")} label="Typ">
            <Select id={id("item_type")} {...register("item_type")}>
              {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("unit_code")} label="Jednotka" error={err("unit_code")}>
            <Select id={id("unit_code")} {...register("unit_code")}>
              {(units.data ?? []).map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code} – {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("division_id")} label="Divízia">
            <Select id={id("division_id")} {...register("division_id")}>
              <option value="">Obe divízie</option>
              {(divisions.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id={id("default_cost_cents")}
            label="Nákupná cena / jednotka"
            hint={HINT_COST}
            error={err("default_cost_cents")}
          >
            <MoneyInput
              id={id("default_cost_cents")}
              invalid={!!err("default_cost_cents")}
              aria-describedby={describedBy(id("default_cost_cents"), {
                hint: HINT_COST,
                error: err("default_cost_cents"),
              })}
              {...register("default_cost_cents")}
            />
          </Field>
          <Field id={id("default_supplier_id")} label="Predvolený dodávateľ">
            <Select id={id("default_supplier_id")} {...register("default_supplier_id")}>
              <option value="">—</option>
              {(suppliers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("default_pricing_mode")} label="Navýšenie">
            <Select id={id("default_pricing_mode")} {...register("default_pricing_mode")}>
              {Object.entries(PRICING_MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          {mode !== "none" && (
            <Field
              id={id("default_pricing_pct")}
              label={mode === "margin" ? "Marža" : "Prirážka"}
              hint={pctHint}
              error={err("default_pricing_pct")}
            >
              <Controller
                control={control}
                name="default_pricing_pct"
                render={({ field }) => (
                  <NumberStepper
                    id={id("default_pricing_pct")}
                    label={mode === "margin" ? "Marža" : "Prirážka"}
                    suffix="%"
                    step={1}
                    // margin: price = cost / (1 − m) → m must stay below 100 %
                    max={mode === "margin" ? 100 : undefined}
                    maxExclusive={mode === "margin"}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    invalid={!!err("default_pricing_pct")}
                    aria-describedby={describedBy(id("default_pricing_pct"), {
                      hint: pctHint,
                      error: err("default_pricing_pct"),
                    })}
                  />
                )}
              />
            </Field>
          )}
          <Field
            id={id("description")}
            label="Popis"
            error={err("description")}
            className="md:col-span-2 xl:col-span-4"
          >
            <Textarea id={id("description")} rows={3} {...register("description")} />
          </Field>
        </div>
        {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
      </form>
    </Tile>
  );
}

const TYPE_FILTERS: { value: ItemType | "all"; label: string }[] = [
  { value: "all", label: "Všetky" },
  ...(Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

export function ItemsTab({ openNew = false }: { openNew?: boolean }) {
  const [type, setType] = useState<ItemType | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(openNew ? "new" : null);
  const items = useCatalogItems({ type, showInactive });
  const setActive = useSetItemActive();

  const columns = useMemo<Column<CatalogItem>[]>(
    () => [
      {
        key: "name",
        header: "Názov",
        cell: (i) => (
          <button
            type="button"
            className="text-navy text-left font-medium hover:underline"
            onClick={() => setEditing(i)}
          >
            {i.name}
          </button>
        ),
      },
      { key: "code", header: "Kód", cell: (i) => i.code ?? "—" },
      { key: "type", header: "Typ", cell: (i) => ITEM_TYPE_LABELS[i.item_type] },
      { key: "unit", header: "Jedn.", cell: (i) => i.unit_code },
      {
        key: "cost",
        header: "Nákup",
        numeric: true,
        cell: (i) => formatMoney(i.default_cost_cents),
      },
      {
        key: "pricing",
        header: "Navýšenie",
        hideOnMobile: true,
        cell: (i) =>
          i.default_pricing_mode === "none"
            ? "—"
            : `${PRICING_MODE_LABELS[i.default_pricing_mode].replace(" %", "")} ${formatPercent(i.default_pricing_pct)} %`,
      },
      {
        key: "state",
        header: "Stav",
        cell: (i) => (
          <span className="flex items-center gap-2">
            {i.is_active ? (
              <StatusBadge label="Aktívna" tone="success" />
            ) : (
              <StatusBadge label="Neaktívna" />
            )}
            <Button
              variant="ghost"
              className="h-8 px-2 text-[13px]"
              disabled={setActive.isPending}
              onClick={() => setActive.mutate({ id: i.id, is_active: !i.is_active })}
              aria-label={`${i.is_active ? "Deaktivovať" : "Aktivovať"} ${i.name}`}
            >
              {i.is_active ? "Deaktivovať" : "Aktivovať"}
            </Button>
          </span>
        ),
      },
    ],
    [setActive],
  );

  return (
    <>
      {editing !== null && (
        <ItemForm
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      <Tile
        size="XL"
        title="Položky katalógu"
        action={
          editing === null ? (
            <Button onClick={() => setEditing("new")}>+ Nová položka</Button>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <ChipGroup label="Typ položky" options={TYPE_FILTERS} value={type} onChange={setType} />
          <ChipGroup
            label="Zobraziť"
            options={[
              { value: "active", label: "Aktívne" },
              { value: "all", label: "Všetky" },
            ]}
            value={showInactive ? "all" : "active"}
            onChange={(v) => setShowInactive(v === "all")}
          />
        </div>
        {items.error && <FormMessage tone="error">{items.error.message}</FormMessage>}
        {setActive.error && <FormMessage tone="error">{setActive.error.message}</FormMessage>}
        {items.isPending ? (
          <div aria-hidden className="bg-canvas h-24 animate-pulse rounded-xl" />
        ) : (
          <DataTable
            caption="Položky katalógu"
            columns={columns}
            rows={items.data ?? []}
            rowKey={(i) => i.id}
            empty={
              <EmptyState
                title="Katalóg je prázdny"
                description="Pridajte prvú položku tlačidlom vpravo hore."
              />
            }
          />
        )}
      </Tile>
    </>
  );
}
