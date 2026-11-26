"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { SettingsTile } from "./settings-tile";
import { useSaveCompany, type Company } from "../api";
import { COMPANY_FIELDS, companySchema, type CompanyInput, type CompanyOutput } from "../schema";

function toInput(c: Company | null): CompanyInput {
  const v = (x: string | null | undefined) => x ?? "";
  return {
    legal_name: v(c?.legal_name) || "AV-agency, s.r.o.",
    brand_name: v(c?.brand_name) || "Add Value Agency",
    ico: v(c?.ico),
    dic: v(c?.dic),
    ic_dph: v(c?.ic_dph),
    street: v(c?.street),
    city: v(c?.city),
    zip: v(c?.zip),
    country: v(c?.country) || "SK",
    registry_entry: v(c?.registry_entry),
    iban: v(c?.iban),
    bank_name: v(c?.bank_name),
    swift: v(c?.swift),
    email: v(c?.email),
    phone: v(c?.phone),
    web: v(c?.web),
  };
}

const FORM_ID = "company-form";

export function CompanyTile({ company }: { company: Company | null }) {
  const save = useSaveCompany();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<CompanyInput, unknown, CompanyOutput>({
    resolver: zodResolver(companySchema),
    defaultValues: toInput(company),
  });

  const submit = handleSubmit(async (values) => {
    setSaved(false);
    const row = await save.mutateAsync({ id: company?.id ?? null, values }).catch(() => null);
    if (row) {
      reset(toInput(row));
      setSaved(true);
    }
  });

  return (
    <SettingsTile
      size="XL"
      title="Firma – údaje na doklady"
      action={
        <Button type="submit" form={FORM_ID} disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Ukladám…" : "Uložiť"}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label="Neplatiteľ DPH" tone="info" />
          <span className="text-[13px] text-neutral-700">Doklady sa vystavujú bez DPH.</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COMPANY_FIELDS.map((f) => {
            const err = errors[f.name]?.message;
            const id = `company-${f.name}`;
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
                  aria-describedby={describedBy(id, { hint: f.hint, error: err })}
                  {...register(f.name)}
                />
              </Field>
            );
          })}
        </div>
        {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
        {saved && !isDirty && <FormMessage tone="success">Údaje firmy sú uložené.</FormMessage>}
      </form>
    </SettingsTile>
  );
}
