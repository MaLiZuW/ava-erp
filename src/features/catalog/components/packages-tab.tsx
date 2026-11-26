"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { formatMoney } from "@/core/format";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { describedBy, Field, FormMessage, Select } from "@/ui/field";
import { KpiNumber } from "@/ui/kpi-number";
import { NumberStepper, stepForUnit } from "@/ui/number-stepper";
import { Tile } from "@/ui/tile";
import {
  useAddComponent,
  useCatalogItems,
  useComponents,
  useRemoveComponent,
  useUpdateComponent,
  type PackageComponent,
} from "../api";
import { componentSchema, type ComponentInput, type ComponentOutput } from "../schema";

/** Indicative cost of one package: Σ component cost × quantity (each line rounded to cents). */
export function packageCostCents(
  rows: readonly Pick<PackageComponent, "quantity" | "component">[],
): number {
  return rows.reduce(
    (sum, r) => sum + Math.round((r.component?.default_cost_cents ?? 0) * Number(r.quantity)),
    0,
  );
}

const qtyText = (q: number) => String(Number(q)).replace(".", ",");

function AddComponentForm({ packageId, excluded }: { packageId: string; excluded: Set<string> }) {
  const add = useAddComponent(packageId);
  // only plain items can be components (one-level bill of materials – owner decision)
  const items = useCatalogItems({ type: "all", showInactive: false });
  const options = (items.data ?? []).filter(
    (i) => i.item_type !== "package" && !excluded.has(i.id),
  );
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ComponentInput, unknown, ComponentOutput>({
    resolver: zodResolver(componentSchema),
    defaultValues: { component_item_id: "", quantity: "1" },
  });
  const selectedId = useWatch({ control, name: "component_item_id" });
  const unit = options.find((i) => i.id === selectedId)?.unit_code;
  const submit = handleSubmit(async (values) => {
    const ok = await add
      .mutateAsync(values)
      .then(() => true)
      .catch(() => false);
    if (ok) reset({ component_item_id: "", quantity: "1" });
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Pridať komponent"
      className="flex flex-wrap items-end gap-3"
    >
      <Field
        id="component-item"
        label="Komponent"
        error={errors.component_item_id?.message}
        className="min-w-64 flex-1"
      >
        <Select
          id="component-item"
          invalid={!!errors.component_item_id}
          {...register("component_item_id")}
        >
          <option value="">Vyberte položku…</option>
          {options.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit_code})
            </option>
          ))}
        </Select>
      </Field>
      <Field id="component-qty" label="Množstvo" error={errors.quantity?.message} className="w-48">
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <NumberStepper
              id="component-qty"
              label="Množstvo komponentu"
              unit={unit}
              min={stepForUnit(unit)}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              invalid={!!errors.quantity}
              aria-describedby={describedBy("component-qty", { error: errors.quantity?.message })}
            />
          )}
        />
      </Field>
      <Button type="submit" disabled={isSubmitting}>
        Pridať
      </Button>
      {add.error && (
        <div className="w-full">
          <FormMessage tone="error">{add.error.message}</FormMessage>
        </div>
      )}
    </form>
  );
}

function QuantityCell({ packageId, row }: { packageId: string; row: PackageComponent }) {
  const update = useUpdateComponent(packageId);
  const [value, setValue] = useState(qtyText(row.quantity));
  const parsed = componentSchema.shape.quantity.safeParse(value);
  const save = (text: string) => {
    const r = componentSchema.shape.quantity.safeParse(text);
    if (r.success && r.data !== Number(row.quantity)) {
      update.mutate({ componentId: row.component_item_id, quantity: r.data });
    }
  };
  const unit = row.component?.unit_code;
  return (
    <NumberStepper
      label={`Množstvo – ${row.component?.name ?? ""}`}
      unit={unit}
      min={stepForUnit(unit)}
      value={value}
      invalid={!parsed.success}
      onChange={setValue}
      onStep={save} // − / + and arrows save immediately
      onBlur={() => save(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") save(value);
      }}
      className="ml-auto w-44"
    />
  );
}

function PackageEditor({ packageId }: { packageId: string }) {
  const components = useComponents(packageId);
  const remove = useRemoveComponent(packageId);
  const rows = components.data ?? [];
  const excluded = new Set([packageId, ...rows.map((r) => r.component_item_id)]);

  return (
    <div className="flex flex-col gap-4">
      {components.error && <FormMessage tone="error">{components.error.message}</FormMessage>}
      {rows.length === 0 ? (
        <EmptyState
          title="Balíček je prázdny"
          description="Pridajte komponenty a ich množstvo na 1 balíček."
        />
      ) : (
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">Kusovník balíčka</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
              <th scope="col" className="h-12 pr-3">
                Komponent
              </th>
              <th scope="col" className="px-3 text-right">
                Množstvo
              </th>
              <th scope="col" className="px-3">
                Jedn.
              </th>
              <th scope="col" className="px-3 text-right">
                Náklad
              </th>
              <th scope="col">
                <span className="sr-only">Akcie</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.component_item_id} className="h-12 border-b border-neutral-200">
                <td className="pr-3">{r.component?.name}</td>
                <td className="px-3 text-right">
                  <QuantityCell packageId={packageId} row={r} />
                </td>
                <td className="px-3">{r.component?.unit_code}</td>
                <td className="px-3 text-right tabular-nums">
                  {formatMoney(
                    Math.round((r.component?.default_cost_cents ?? 0) * Number(r.quantity)),
                  )}
                </td>
                <td className="text-right">
                  <Button
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(r.component_item_id)}
                    aria-label={`Odobrať ${r.component?.name ?? ""}`}
                  >
                    Odobrať
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {remove.error && <FormMessage tone="error">{remove.error.message}</FormMessage>}
      <AddComponentForm packageId={packageId} excluded={excluded} />
    </div>
  );
}

export function PackagesTab() {
  const packages = useCatalogItems({ type: "package", showInactive: false });
  const [selected, setSelected] = useState<string>("");
  const current = selected || packages.data?.[0]?.id || "";
  const components = useComponents(current || null);

  if (packages.data?.length === 0) {
    return (
      <Tile size="XL" title="Balíčky">
        <EmptyState
          title="Zatiaľ žiadny balíček"
          description="V záložke Položky vytvorte položku typu Balíček (napr. mikulášsky balíček) a potom tu zadajte jej komponenty."
        />
      </Tile>
    );
  }

  return (
    <>
      <Tile size="XL" title="Kusovník balíčka">
        <div className="flex flex-col gap-4">
          <Field id="package-select" label="Balíček" className="max-w-md">
            <Select
              id="package-select"
              value={current}
              onChange={(e) => setSelected(e.target.value)}
            >
              {(packages.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          {current && <PackageEditor key={current} packageId={current} />}
        </div>
      </Tile>
      <Tile size="S" title="Náklad 1 balíčka">
        <KpiNumber
          value={formatMoney(packageCostCents(components.data ?? []))}
          hint="Orientačne z nákupných cien komponentov."
        />
      </Tile>
    </>
  );
}
