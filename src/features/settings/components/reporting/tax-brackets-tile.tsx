"use client";

import { ReviewControl } from "@/core/data-review";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { formatDate, formatMoney, formatMoneyInput, formatPercent } from "@/core/format";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { DateInput, MoneyInput, PercentInput } from "@/ui/inputs";
import { SettingsTile } from "../settings-tile";
import { taxBracketSchema, type TaxBracketInput, type TaxBracketOutput } from "../../reporting";
import { useSaveTaxBracket, useTaxBrackets, type TaxBracket } from "../../reporting-api";

export const TAX_WARNING =
  "Sadzby a pásma dane z príjmov právnických osôb zadajte podľa aktuálneho zákona a overte ich s účtovníkom. Systém z nich počíta len informatívny odhad.";

const FIELDS: {
  name: keyof TaxBracketInput;
  label: string;
  kind: "date" | "money" | "pct" | "text";
  hint?: string;
}[] = [
  { name: "valid_from", label: "Platí od", kind: "date" },
  { name: "valid_to", label: "Platí do", kind: "date", hint: "Prázdne = platí naďalej." },
  { name: "revenue_from_cents", label: "Výnosy od", kind: "money" },
  {
    name: "revenue_to_cents",
    label: "Výnosy do",
    kind: "money",
    hint: "Prázdne = bez hornej hranice.",
  },
  { name: "rate_pct", label: "Sadzba dane", kind: "pct" },
  { name: "source_note", label: "Zdroj (zákon, overil)", kind: "text" },
];

function BracketForm({ row, onDone }: { row: TaxBracket | null; onDone: () => void }) {
  const save = useSaveTaxBracket();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaxBracketInput, unknown, TaxBracketOutput>({
    resolver: zodResolver(taxBracketSchema),
    defaultValues: {
      valid_from: row ? formatDate(row.valid_from) : "",
      valid_to: row?.valid_to ? formatDate(row.valid_to) : "",
      revenue_from_cents: row ? formatMoneyInput(row.revenue_from_cents) : "0",
      revenue_to_cents: row?.revenue_to_cents == null ? "" : formatMoneyInput(row.revenue_to_cents),
      rate_pct: row ? formatPercent(row.rate_pct) : "",
      source_note: row?.source_note ?? "",
    },
  });
  const submit = handleSubmit(async (values) => {
    const ok = await save
      .mutateAsync({ id: row?.id ?? null, values })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={row ? "Úprava pásma" : "Nové pásmo"}
      className="bg-canvas/50 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 p-4 md:grid-cols-2"
    >
      {FIELDS.map((f) => {
        const id = `tax-${f.name}`;
        const err = errors[f.name]?.message;
        const props = {
          id,
          invalid: !!err,
          "aria-describedby": describedBy(id, { hint: f.hint, error: err }),
          ...register(f.name),
        };
        return (
          <Field key={f.name} id={id} label={f.label} hint={f.hint} error={err}>
            {f.kind === "date" ? (
              <DateInput {...props} />
            ) : f.kind === "money" ? (
              <MoneyInput {...props} />
            ) : f.kind === "pct" ? (
              <PercentInput {...props} />
            ) : (
              <Input {...props} />
            )}
          </Field>
        );
      })}
      {save.error && (
        <div className="md:col-span-2">
          <FormMessage tone="error">{save.error.message}</FormMessage>
        </div>
      )}
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          Uložiť pásmo
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </form>
  );
}

/** Income tax brackets – no values in code, entered by the owner (DATABASE_SCHEMA.md §18). */
export function TaxBracketsTile() {
  const rows = useTaxBrackets();
  const [editing, setEditing] = useState<TaxBracket | "new" | null>(null);
  return (
    <SettingsTile
      size="L"
      title="Daň z príjmov – pásma"
      className="md:row-span-3"
      action={
        editing === null ? (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            Pridať pásmo
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <p
          role="note"
          data-testid="tax-warning"
          className="border-warning/40 text-warning rounded-xl border px-3 py-2 text-[15px] font-medium"
        >
          {TAX_WARNING}
        </p>
        {editing !== null && (
          <BracketForm
            key={editing === "new" ? "new" : editing.id}
            row={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
        {rows.error && <FormMessage tone="error">{rows.error.message}</FormMessage>}
        {rows.data?.length === 0 ? (
          <EmptyState
            title="Zatiaľ bez pásiem"
            description="Odhad dane sa na prehľade zobrazí, až keď tu bude aspoň jedno pásmo."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200">
            {(rows.data ?? []).map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                <div className="tabular-nums">
                  <p className="font-medium">
                    {formatPercent(r.rate_pct)} % · {formatMoney(r.revenue_from_cents)} –{" "}
                    {r.revenue_to_cents == null ? "bez hranice" : formatMoney(r.revenue_to_cents)}
                  </p>
                  <p className="text-[13px] text-neutral-700">
                    {formatDate(r.valid_from)} – {r.valid_to ? formatDate(r.valid_to) : "…"}
                    {r.source_note && ` · ${r.source_note}`}
                  </p>
                </div>
                <span className="flex flex-wrap items-center justify-end gap-1">
                  {!r.valid_to && (
                    <ReviewControl entityTable="income_tax_brackets" entityId={r.id} />
                  )}
                  <Button variant="ghost" onClick={() => setEditing(r)}>
                    Upraviť
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsTile>
  );
}
