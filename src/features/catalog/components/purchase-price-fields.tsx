"use client";

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { costToEurCents, parseRateMicro } from "@/core/calc/purchase-price";
import { formatDate, formatMoney, parseMoneyToCents, parsePercent } from "@/core/format";
import { Checkbox, describedBy, Field, Input, Select } from "@/ui/field";
import { DateInput, MoneyInput, PercentInput } from "@/ui/inputs";
import { useCurrencies, type CatalogItem } from "../api";
import type { ItemInput, ItemOutput } from "../schema";

const SOURCE_LABELS: Record<string, string> = {
  manual: "ručne",
  import: "import cenníka",
  rollback: "vrátenie dávky importu",
};

/** Live EUR price without VAT – the same computation as the database (D26). */
export function eurPreview(v: {
  amount: string;
  currency: string;
  includesVat: boolean;
  vat: string;
  rate: string;
}): number | null {
  const cents = parseMoneyToCents(v.amount ?? "");
  if (cents == null || cents < 0) return null;
  const vatPct = v.includesVat ? parsePercent(v.vat ?? "") : null;
  if (v.includesVat && vatPct == null) return null;
  const rateMicro = v.currency === "EUR" ? 1_000_000n : parseRateMicro(v.rate ?? "");
  if (rateMicro == null) return null;
  return costToEurCents(cents, { vatPct, rateMicro });
}

/**
 * Purchase price as on the supplier's price list: currency, with / without VAT (rate entered by
 * the user), exchange rate for other currencies. The catalog keeps the EUR price without VAT.
 */
export function PurchasePriceFields({
  id,
  register,
  control,
  errors,
  item,
}: {
  id: (n: string) => string;
  register: UseFormRegister<ItemInput>;
  control: Control<ItemInput, unknown, ItemOutput>;
  errors: FieldErrors<ItemInput>;
  item: CatalogItem | null;
}) {
  const currencies = useCurrencies();
  const [currency, amount, includesVat, vat, rate] = useWatch({
    control,
    name: [
      "cost_currency",
      "cost_original_amount",
      "cost_includes_vat",
      "cost_vat_rate_pct",
      "cost_fx_rate",
    ],
  });
  const eur = eurPreview({ amount, currency, includesVat, vat, rate });
  const err = (n: keyof ItemInput) => errors[n]?.message;
  const plainEur = currency === "EUR" && !includesVat;
  const hint = plainEur
    ? "Posledná známa cena bez DPH."
    : `Ako v cenníku (${currency}${includesVat ? ", s DPH" : ""}).`;

  return (
    <>
      <Field id={id("cost_currency")} label="Mena nákupu">
        <Select
          id={id("cost_currency")}
          key={currencies.data ? "loaded" : "loading"}
          {...register("cost_currency")}
        >
          {(currencies.data ?? [{ code: "EUR", name: "euro" }]).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} – {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id={id("cost_original_amount")}
        label="Nákupná cena / jednotka"
        hint={hint}
        error={err("cost_original_amount")}
      >
        <MoneyInput
          id={id("cost_original_amount")}
          invalid={!!err("cost_original_amount")}
          aria-describedby={describedBy(id("cost_original_amount"), {
            hint,
            error: err("cost_original_amount"),
          })}
          {...register("cost_original_amount")}
        />
      </Field>
      <div className="flex flex-col justify-end gap-1">
        <Checkbox label="Cena je s DPH" {...register("cost_includes_vat")} />
      </div>
      {includesVat ? (
        <Field id={id("cost_vat_rate_pct")} label="Sadzba DPH %" error={err("cost_vat_rate_pct")}>
          <PercentInput
            id={id("cost_vat_rate_pct")}
            invalid={!!err("cost_vat_rate_pct")}
            aria-describedby={describedBy(id("cost_vat_rate_pct"), {
              error: err("cost_vat_rate_pct"),
            })}
            {...register("cost_vat_rate_pct")}
          />
        </Field>
      ) : (
        <div className="hidden xl:block" />
      )}
      {currency !== "EUR" && (
        <>
          <Field
            id={id("cost_fx_rate")}
            label={`Kurz (${currency} za 1 EUR)`}
            hint="Ako kurzový lístok ECB / NBS."
            error={err("cost_fx_rate")}
          >
            <Input
              id={id("cost_fx_rate")}
              inputMode="decimal"
              invalid={!!err("cost_fx_rate")}
              aria-describedby={describedBy(id("cost_fx_rate"), {
                hint: "Ako kurzový lístok ECB / NBS.",
                error: err("cost_fx_rate"),
              })}
              {...register("cost_fx_rate")}
            />
          </Field>
          <Field id={id("cost_fx_date")} label="Dátum kurzu" error={err("cost_fx_date")}>
            <DateInput
              id={id("cost_fx_date")}
              invalid={!!err("cost_fx_date")}
              aria-describedby={describedBy(id("cost_fx_date"), { error: err("cost_fx_date") })}
              {...register("cost_fx_date")}
            />
          </Field>
        </>
      )}
      <div className="flex flex-col justify-end md:col-span-2">
        <p className="text-[13px] font-medium text-neutral-700">V katalógu (EUR bez DPH)</p>
        <p
          data-testid="cost-eur-preview"
          className="text-navy text-[20px] leading-7 font-semibold tabular-nums"
        >
          {eur == null ? "—" : formatMoney(eur)}
        </p>
        {item?.cost_updated_at && (
          <p className="text-[13px] text-neutral-500" data-testid="cost-origin">
            Cena zmenená {formatDate(item.cost_updated_at)} ·{" "}
            {SOURCE_LABELS[item.cost_source] ?? item.cost_source}
          </p>
        )}
      </div>
    </>
  );
}
