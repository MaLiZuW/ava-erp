"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useAttachmentQueue } from "@/core/attachments/api";
import { AttachmentsTile, NewRecordAttachments } from "@/core/attachments/attachments-tile";
import { formatDate, formatMoney, formatMoneyInput, formatPercent } from "@/core/format";
import { useDocuments, useSignedUrl } from "@/core/storage/documents";
import { Button } from "@/ui/button";
import { ChipGroup } from "@/ui/chips";
import { DataTable, type Column } from "@/ui/data-table";
import { EmptyState } from "@/ui/empty-state";
import { describedBy, Field, FormMessage, Input, Select, Textarea } from "@/ui/field";
import { NumberStepper } from "@/ui/number-stepper";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import {
  useCatalogItems,
  useCatalogThumbs,
  useDivisions,
  useSaveItem,
  useSetItemActive,
  useSetMainPhoto,
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
import { PurchasePriceFields } from "./purchase-price-fields";

const HINT_CODE = "Nepovinné, napr. PRM-HRNCEK.";
const HINT_EAN = "Nepovinné; 8, 12, 13 alebo 14 číslic.";

const toInput = (i: CatalogItem | null): ItemInput => ({
  code: i?.code ?? "",
  name: i?.name ?? "",
  item_type: i?.item_type ?? "goods",
  division_id: i?.division_id ?? "",
  unit_code: i?.unit_code ?? "ks",
  cost_original_amount: formatMoneyInput(i?.cost_original_amount ?? i?.default_cost_cents ?? 0),
  cost_currency: i?.cost_currency ?? "EUR",
  cost_includes_vat: i?.cost_includes_vat ?? false,
  cost_vat_rate_pct: formatPercent(i?.cost_vat_rate_pct),
  cost_fx_rate: i?.cost_fx_rate == null ? "" : String(i.cost_fx_rate).replace(".", ","),
  cost_fx_date: i?.cost_fx_date ? formatDate(i.cost_fx_date) : "",
  supplier_item_code: i?.supplier_item_code ?? "",
  ean: i?.ean ?? "",
  default_supplier_id: i?.default_supplier_id ?? "",
  default_pricing_mode: i?.default_pricing_mode ?? "none",
  default_pricing_pct: formatPercent(i?.default_pricing_pct),
  description: i?.description ?? "",
});

/** Main photo of an item (for quotes and the presentation): large preview, removal. */
function MainPhoto({ item }: { item: CatalogItem }) {
  const docs = useDocuments(item.main_photo_document_id ? [item.main_photo_document_id] : []);
  const doc = item.main_photo_document_id ? docs.data?.[0] : undefined;
  const url = useSignedUrl(doc?.storage_path, doc?.storage_provider);
  const setMain = useSetMainPhoto();
  return (
    <div className="flex w-full shrink-0 flex-col gap-2 md:w-48" data-testid="main-photo">
      <div className="bg-canvas flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-200">
        {url.data ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL of a private file
          <img
            src={url.data}
            alt={`Hlavná fotka – ${item.name}`}
            className="size-full object-cover"
          />
        ) : (
          <span className="px-3 text-center text-[13px] text-neutral-500">
            {item.main_photo_document_id ? "Načítavam…" : "Bez hlavnej fotky"}
          </span>
        )}
      </div>
      {item.main_photo_document_id ? (
        <Button
          variant="ghost"
          className="h-8 px-2 text-[13px]"
          disabled={setMain.isPending}
          onClick={() => setMain.mutate({ itemId: item.id, documentId: null })}
        >
          Odstrániť hlavnú fotku
        </Button>
      ) : (
        <p className="text-[13px] text-neutral-500">Nahrajte fotku v Prílohách nižšie.</p>
      )}
      {setMain.error && <FormMessage tone="error">{setMain.error.message}</FormMessage>}
    </div>
  );
}

export function ItemForm({
  item,
  onDone,
  defaults,
  onSaved,
  title,
}: {
  item: CatalogItem | null;
  onDone: () => void;
  /** values of a new item (e.g. a package: type Balíček, unit bal) */
  defaults?: Partial<ItemInput>;
  onSaved?: (saved: CatalogItem) => void;
  title?: string;
}) {
  const save = useSaveItem();
  const setMain = useSetMainPhoto();
  const units = useUnits();
  const divisions = useDivisions();
  const suppliers = useSupplierOptions();
  const queue = useAttachmentQueue();
  // a new item that is saved but whose files did not all upload stays open ("Nahrať znova")
  const [saved, setSaved] = useState<CatalogItem | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ItemInput, unknown, ItemOutput>({
    resolver: zodResolver(itemSchema),
    defaultValues: { ...toInput(item), ...defaults },
  });

  /** uploads the queued files of a new item; the first photo becomes its main photo */
  const uploadQueue = async (row: CatalogItem) => {
    const { stored, failed } = await queue.run("catalog_items", row.id);
    const photo = stored.find((d) => d.category === "photo");
    if (photo && !row.main_photo_document_id) {
      await setMain.mutateAsync({ itemId: row.id, documentId: photo.id }).catch(() => undefined);
    }
    if (failed === 0) {
      onSaved?.(row);
      onDone();
    }
  };
  const mode = useWatch({ control, name: "default_pricing_mode" });
  const pctHint =
    mode === "margin" ? "Cena = náklad ÷ (1 − marža)." : "Cena = náklad × (1 + prirážka).";
  const formId = "catalog-item-form";
  const id = (n: string) => `${formId}-${n}`;
  const err = (n: keyof ItemInput) => errors[n]?.message;

  const submit = handleSubmit(async (values) => {
    const row = await save
      .mutateAsync({ id: item?.id ?? saved?.id ?? null, values })
      .catch(() => null);
    if (!row) return;
    if (item) {
      onSaved?.(row);
      onDone();
      return;
    }
    setSaved(row);
    await uploadQueue(row);
  });

  return (
    <>
      <Tile
        size="XL"
        title={title ?? (item ? `Položka – ${item.name}` : "Nová položka katalógu")}
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
          <div className="flex flex-col gap-4 md:flex-row">
            {item && <MainPhoto item={item} />}
            <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  aria-describedby={describedBy(id("code"), {
                    hint: HINT_CODE,
                    error: err("code"),
                  })}
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
                <Select
                  id={id("unit_code")}
                  // re-mounted when the options arrive, so the select shows the form value
                  key={units.data ? "loaded" : "loading"}
                  {...register("unit_code")}
                >
                  {(units.data ?? []).map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code} – {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={id("division_id")} label="Divízia">
                <Select
                  id={id("division_id")}
                  key={divisions.data ? "loaded" : "loading"}
                  {...register("division_id")}
                >
                  <option value="">Obe divízie</option>
                  {(divisions.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id={id("supplier_item_code")}
                label="Kód dodávateľa"
                error={err("supplier_item_code")}
              >
                <Input
                  id={id("supplier_item_code")}
                  invalid={!!err("supplier_item_code")}
                  aria-describedby={describedBy(id("supplier_item_code"), {
                    error: err("supplier_item_code"),
                  })}
                  {...register("supplier_item_code")}
                />
              </Field>
              <Field id={id("ean")} label="EAN / GTIN" hint={HINT_EAN} error={err("ean")}>
                <Input
                  id={id("ean")}
                  inputMode="numeric"
                  invalid={!!err("ean")}
                  aria-describedby={describedBy(id("ean"), { hint: HINT_EAN, error: err("ean") })}
                  {...register("ean")}
                />
              </Field>
              <PurchasePriceFields
                id={id}
                register={register}
                control={control}
                errors={errors}
                item={item}
              />
              <Field id={id("default_supplier_id")} label="Predvolený dodávateľ">
                <Select
                  id={id("default_supplier_id")}
                  key={suppliers.data ? "loaded" : "loading"}
                  {...register("default_supplier_id")}
                >
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
          </div>
          {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
        </form>
        {!item && (
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <NewRecordAttachments
              queue={queue}
              busy={isSubmitting}
              retry={saved ? () => void uploadQueue(saved) : undefined}
            />
          </div>
        )}
      </Tile>
      {item && (
        <AttachmentsTile
          entityTable="catalog_items"
          entityId={item.id}
          mainPhotoId={item.main_photo_document_id}
          onSetMainPhoto={(documentId) => setMain.mutate({ itemId: item.id, documentId })}
          onUploaded={(docs) => {
            const photo = docs.find((d) => d.category === "photo");
            if (photo && !item.main_photo_document_id)
              setMain.mutate({ itemId: item.id, documentId: photo.id });
          }}
        />
      )}
    </>
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
  const thumbs = useCatalogThumbs(items.data ?? []);
  // the open item is read again from the list, so a new main photo shows up at once
  const current =
    editing === "new" || editing === null
      ? null
      : (items.data?.find((i) => i.id === editing.id) ?? editing);

  const columns = useMemo<Column<CatalogItem>[]>(
    () => [
      {
        key: "photo",
        header: "Foto",
        hideOnMobile: true,
        cell: (i) => {
          const url = thumbs.get(i.id);
          return url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL of a private file
            <img
              src={url}
              alt=""
              data-testid="item-thumb"
              className="size-10 rounded-md border border-neutral-200 object-cover"
            />
          ) : (
            <span aria-hidden className="bg-canvas block size-10 rounded-md" />
          );
        },
      },
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
    [setActive, thumbs],
  );

  return (
    <>
      {editing !== null && (
        <ItemForm
          key={editing === "new" ? "new" : editing.id}
          item={current}
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
