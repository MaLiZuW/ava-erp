"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/ui/button";
import { Checkbox, describedBy, Field, FormMessage, Input, Select, Textarea } from "@/ui/field";
import { Tile } from "@/ui/tile";
import { useSaveParty, type Party } from "../api";
import {
  PARTY_TEXT,
  partySchema,
  type PartyInput,
  type PartyKind,
  type PartyOutput,
} from "../schema";
import { ForeignSupplierNotice } from "./foreign-supplier-notice";

function toInput(p: Party | null): PartyInput {
  const v = (x: string | null | undefined) => x ?? "";
  return {
    kind: p?.kind ?? "company",
    name: v(p?.name),
    ico: v(p?.ico),
    dic: v(p?.dic),
    ic_dph: v(p?.ic_dph),
    vat_payer: p?.vat_payer ?? false,
    street: v(p?.street),
    city: v(p?.city),
    zip: v(p?.zip),
    country: v(p?.country) || "SK",
    billing_email: v(p?.billing_email),
    payment_terms_days: p?.payment_terms_days == null ? "" : String(p.payment_terms_days),
    note: v(p?.note),
    categories: (p?.categories ?? []).join(", "),
  };
}

type TextField = Exclude<keyof PartyInput, "kind" | "vat_payer" | "note">;

const FIELDS: {
  name: TextField;
  label: string;
  hint?: string;
  wide?: boolean;
  suppliersOnly?: boolean;
}[] = [
  { name: "name", label: "Názov / meno", wide: true },
  { name: "ico", label: "IČO" },
  { name: "dic", label: "DIČ" },
  { name: "ic_dph", label: "IČ DPH", hint: "Len pri platiteľovi DPH, napr. SK2020123456." },
  {
    name: "billing_email",
    label: "Fakturačný e-mail",
    hint: "Všeobecná adresa, napr. faktury@firma.sk.",
  },
  { name: "street", label: "Ulica a číslo", wide: true },
  { name: "city", label: "Mesto" },
  { name: "zip", label: "PSČ" },
  { name: "country", label: "Krajina", hint: "Kód krajiny: SK, CZ, DE …" },
  { name: "payment_terms_days", label: "Splatnosť (dni)", hint: "Prázdne = podľa nastavení." },
  {
    name: "categories",
    label: "Kategórie",
    hint: "Oddeľte čiarkou, napr. potlač, catering.",
    wide: true,
    suppliersOnly: true,
  },
];

/** Create / edit form of a customer or supplier. */
export function PartyForm({
  kind,
  party,
  onSaved,
  onCancel,
}: {
  kind: PartyKind;
  party: Party | null;
  onSaved: (saved: Party) => void;
  onCancel?: () => void;
}) {
  const save = useSaveParty(kind);
  const formId = `party-form-${kind}`;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PartyInput, unknown, PartyOutput>({
    resolver: zodResolver(partySchema),
    defaultValues: toInput(party),
  });
  const country = (useWatch({ control, name: "country" }) ?? "").trim().toUpperCase();

  const submit = handleSubmit(async (values) => {
    const row = await save.mutateAsync({ id: party?.id ?? null, values }).catch(() => null);
    if (row) onSaved(row);
  });

  return (
    <Tile
      size="XL"
      title={party ? `${PARTY_TEXT[kind].one} – úprava údajov` : PARTY_TEXT[kind].newLabel}
      action={
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Zrušiť
            </Button>
          )}
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? "Ukladám…" : "Uložiť"}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {kind === "suppliers" && /^[A-Z]{2}$/.test(country) && country !== "SK" && (
          <ForeignSupplierNotice />
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field id={`${formId}-kind`} label="Typ">
            <Select id={`${formId}-kind`} {...register("kind")}>
              <option value="company">Firma</option>
              <option value="person">Fyzická osoba</option>
            </Select>
          </Field>
          {FIELDS.filter((f) => !f.suppliersOnly || kind === "suppliers").map((f) => {
            const err = errors[f.name]?.message;
            const id = `${formId}-${f.name}`;
            return (
              <Field
                key={f.name}
                id={id}
                label={f.label}
                hint={f.hint}
                error={err}
                className={f.wide ? "md:col-span-2" : undefined}
              >
                <Input
                  id={id}
                  invalid={!!err}
                  inputMode={f.name === "payment_terms_days" ? "numeric" : undefined}
                  aria-describedby={describedBy(id, { hint: f.hint, error: err })}
                  {...register(f.name)}
                />
              </Field>
            );
          })}
          <div className="flex items-end md:col-span-2">
            <Checkbox label="Platiteľ DPH" {...register("vat_payer")} />
          </div>
          <Field
            id={`${formId}-note`}
            label="Poznámka"
            error={errors.note?.message}
            className="md:col-span-2 xl:col-span-4"
          >
            <Textarea
              id={`${formId}-note`}
              rows={3}
              invalid={!!errors.note}
              aria-describedby={describedBy(`${formId}-note`, { error: errors.note?.message })}
              {...register("note")}
            />
          </Field>
        </div>
        {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
      </form>
    </Tile>
  );
}
