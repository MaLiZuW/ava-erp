"use client";

import { ReviewControl } from "@/core/data-review";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { formatDate, formatMoney, formatMoneyInput } from "@/core/format";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { DateInput, MoneyInput } from "@/ui/inputs";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import {
  useRates,
  useRoles,
  useSaveRate,
  useSaveRole,
  type LaborRate,
  type LaborRole,
} from "../api";
import { rateSchema, roleSchema, type RateInput, type RateOutput, type RoleInput } from "../schema";

/** The rate valid today (validity is inclusive on both ends; open end = still valid). */
export function currentRate(rates: readonly LaborRate[], today: string): LaborRate | undefined {
  return rates.find((r) => r.valid_from <= today && (r.valid_to == null || r.valid_to >= today));
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function RateForm({
  role,
  rate,
  onDone,
}: {
  role: LaborRole;
  rate: LaborRate | null;
  onDone: () => void;
}) {
  const save = useSaveRate();
  const base = `rate-${role.id}-${rate?.id ?? "new"}`;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RateInput, unknown, RateOutput>({
    resolver: zodResolver(rateSchema),
    defaultValues: {
      cost_rate_cents: rate ? formatMoneyInput(rate.cost_rate_cents) : "",
      bill_rate_cents: rate ? formatMoneyInput(rate.bill_rate_cents) : "",
      valid_from: rate ? formatDate(rate.valid_from) : formatDate(todayIso()),
      valid_to: rate?.valid_to ? formatDate(rate.valid_to) : "",
    },
  });
  const submit = handleSubmit(async (values) => {
    const ok = await save
      .mutateAsync({ id: rate?.id ?? null, roleId: role.id, values })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });
  const f = (name: keyof RateInput) => ({ id: `${base}-${name}`, err: errors[name]?.message });
  const hintCost = "Cieľová hodnota hodiny pre kalkuláciu (nie mzda).";

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={rate ? "Úprava sadzby" : "Nová sadzba"}
      className="bg-canvas/50 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          id={f("cost_rate_cents").id}
          label="Kalkulačná sadzba / h"
          hint={hintCost}
          error={f("cost_rate_cents").err}
        >
          <MoneyInput
            id={f("cost_rate_cents").id}
            invalid={!!f("cost_rate_cents").err}
            aria-describedby={describedBy(f("cost_rate_cents").id, {
              hint: hintCost,
              error: f("cost_rate_cents").err,
            })}
            {...register("cost_rate_cents")}
          />
        </Field>
        <Field
          id={f("bill_rate_cents").id}
          label="Fakturovaná sadzba / h"
          error={f("bill_rate_cents").err}
        >
          <MoneyInput
            id={f("bill_rate_cents").id}
            invalid={!!f("bill_rate_cents").err}
            aria-describedby={describedBy(f("bill_rate_cents").id, {
              error: f("bill_rate_cents").err,
            })}
            {...register("bill_rate_cents")}
          />
        </Field>
        <Field id={f("valid_from").id} label="Platí od" error={f("valid_from").err}>
          <DateInput
            id={f("valid_from").id}
            invalid={!!f("valid_from").err}
            aria-describedby={describedBy(f("valid_from").id, { error: f("valid_from").err })}
            {...register("valid_from")}
          />
        </Field>
        <Field
          id={f("valid_to").id}
          label="Platí do"
          hint="Prázdne = platí naďalej."
          error={f("valid_to").err}
        >
          <DateInput
            id={f("valid_to").id}
            invalid={!!f("valid_to").err}
            aria-describedby={describedBy(f("valid_to").id, {
              hint: "Prázdne = platí naďalej.",
              error: f("valid_to").err,
            })}
            {...register("valid_to")}
          />
        </Field>
      </div>
      {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Uložiť sadzbu
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </form>
  );
}

function RoleCard({ role, rates }: { role: LaborRole; rates: LaborRate[] }) {
  const [editing, setEditing] = useState<LaborRate | "new" | null>(null);
  const saveRole = useSaveRole();
  const now = currentRate(rates, todayIso());

  return (
    <Tile
      size="L"
      title={role.name}
      className="md:row-span-2"
      action={
        editing === null ? (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            Nová sadzba
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {role.is_active ? (
            <StatusBadge label="Aktívna" tone="success" />
          ) : (
            <StatusBadge label="Neaktívna" />
          )}
          {now ? (
            <span className="text-[15px] tabular-nums">
              Dnes: {formatMoney(now.cost_rate_cents)} / {formatMoney(now.bill_rate_cents)} za
              hodinu
            </span>
          ) : (
            <StatusBadge label="Bez platnej sadzby" tone="warning" />
          )}
          <Button
            variant="ghost"
            className="ml-auto"
            disabled={saveRole.isPending}
            onClick={() => saveRole.mutate({ id: role.id, is_active: !role.is_active })}
          >
            {role.is_active ? "Deaktivovať rolu" : "Aktivovať rolu"}
          </Button>
        </div>
        {editing !== null && (
          <RateForm
            key={editing === "new" ? "new" : editing.id}
            role={role}
            rate={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
        {rates.length > 0 && (
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">História sadzieb – {role.name}</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
                <th scope="col" className="h-10 pr-3">
                  Platnosť
                </th>
                <th scope="col" className="px-3 text-right">
                  Kalkulačná
                </th>
                <th scope="col" className="px-3 text-right">
                  Fakturovaná
                </th>
                <th scope="col">
                  <span className="sr-only">Akcie</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="h-12 border-b border-neutral-200">
                  <td className="pr-3 tabular-nums">
                    {formatDate(r.valid_from)} – {r.valid_to ? formatDate(r.valid_to) : "…"}
                  </td>
                  <td className="px-3 text-right tabular-nums">{formatMoney(r.cost_rate_cents)}</td>
                  <td className="px-3 text-right tabular-nums">{formatMoney(r.bill_rate_cents)}</td>
                  <td className="text-right whitespace-nowrap">
                    {!r.valid_to && <ReviewControl entityTable="labor_rates" entityId={r.id} />}
                    <Button variant="ghost" onClick={() => setEditing(r)}>
                      Upraviť
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {saveRole.error && <FormMessage tone="error">{saveRole.error.message}</FormMessage>}
      </div>
    </Tile>
  );
}

function NewRoleForm() {
  const save = useSaveRole();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoleInput>({ resolver: zodResolver(roleSchema), defaultValues: { name: "" } });
  const submit = handleSubmit(async ({ name }) => {
    const ok = await save
      .mutateAsync({ id: null, name })
      .then(() => true)
      .catch(() => false);
    if (ok) reset();
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Nová rola"
      className="flex flex-wrap items-end gap-3"
    >
      <Field
        id="role-name"
        label="Názov roly"
        hint="Napr. Konzultant, Projektový manažér."
        error={errors.name?.message}
        className="min-w-60 flex-1"
      >
        <Input
          id="role-name"
          invalid={!!errors.name}
          aria-describedby={describedBy("role-name", {
            hint: "Napr. Konzultant, Projektový manažér.",
            error: errors.name?.message,
          })}
          {...register("name")}
        />
      </Field>
      <Button type="submit" disabled={isSubmitting}>
        Pridať rolu
      </Button>
      {save.error && (
        <div className="w-full">
          <FormMessage tone="error">{save.error.message}</FormMessage>
        </div>
      )}
    </form>
  );
}

export function RatesTab() {
  const roles = useRoles();
  const rates = useRates();
  return (
    <>
      <Tile size="HERO" title="Roly a hodinové sadzby">
        <div className="flex flex-col gap-3">
          <p className="text-[15px] text-neutral-700">
            Sadzba má platnosť od–do; obdobia jednej roly sa nesmú prekrývať. Ponuka si pri
            vytvorení uloží použitú sadzbu, preto zmena sadzby nezmení staré ponuky.
          </p>
          <NewRoleForm />
        </div>
      </Tile>
      {roles.error && <FormMessage tone="error">{roles.error.message}</FormMessage>}
      {roles.data?.length === 0 && (
        <Tile size="L" title="Roly">
          <EmptyState
            title="Zatiaľ žiadna rola"
            description="Hodnoty sadzieb zadáva vlastník (O5)."
          />
        </Tile>
      )}
      {(roles.data ?? []).map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          rates={(rates.data ?? []).filter((r) => r.role_id === role.id)}
        />
      ))}
    </>
  );
}
