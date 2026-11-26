"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import { useAddRecipient, useRecipients, useSetRecipientActive } from "../api";
import { recipientSchema, type RecipientInput } from "../schema";

const FORM_ID = "recipient-form";

/**
 * Who receives system notifications by e-mail. Event types are assigned when the notifications
 * themselves arrive (later phases) – no business rules are invented here.
 */
export function RecipientsTile() {
  const list = useRecipients();
  const add = useAddRecipient();
  const setActive = useSetRecipientActive();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecipientInput, unknown, { email: string }>({
    resolver: zodResolver(recipientSchema),
  });

  const submit = handleSubmit(({ email }) =>
    add.mutate(email, { onSuccess: () => reset({ email: "" }) }),
  );
  const err = errors.email?.message;

  return (
    <Tile
      size="L"
      title="Notifikácie – príjemcovia"
      action={
        <Button type="submit" form={FORM_ID} variant="secondary" disabled={add.isPending}>
          Pridať
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="mb-4">
        <Field id="recipient-email" label="E-mail príjemcu" error={err}>
          <Input
            id="recipient-email"
            type="email"
            invalid={!!err}
            aria-describedby={describedBy("recipient-email", { error: err })}
            {...register("email")}
          />
        </Field>
      </form>
      {(add.error || setActive.error) && (
        <FormMessage tone="error">{(add.error ?? setActive.error)?.message}</FormMessage>
      )}
      {list.data && list.data.length === 0 && <p className="text-neutral-700">Zatiaľ nikto.</p>}
      <ul className="flex flex-col">
        {(list.data ?? []).map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-4 border-b border-neutral-200 py-2 last:border-b-0"
          >
            <span className="break-all">{r.email}</span>
            <span className="flex items-center gap-2">
              <StatusBadge
                label={r.is_active ? "Aktívny" : "Vypnutý"}
                tone={r.is_active ? "success" : "neutral"}
              />
              <Button
                variant="ghost"
                disabled={setActive.isPending}
                onClick={() => setActive.mutate({ id: r.id, is_active: !r.is_active })}
              >
                {r.is_active ? "Vypnúť" : "Zapnúť"}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-neutral-500">
        Typy udalostí sa priradia, keď pribudnú notifikácie v ďalších fázach.
      </p>
    </Tile>
  );
}
