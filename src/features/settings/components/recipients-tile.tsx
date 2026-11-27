"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { SettingsTile } from "./settings-tile";
import { NOTIFICATION_EVENTS } from "@/core/notification-events";
import {
  useAddRecipient,
  useRecipients,
  useSetRecipientActive,
  useSetRecipientEvents,
} from "../api";
import { recipientSchema, type RecipientInput } from "../schema";

const FORM_ID = "recipient-form";

/**
 * Who receives system notifications by e-mail and which events. The list of events is in core
 * (NOTIFICATION_EVENTS, checked by the DB); sending arrives in phase 8.
 */
export function RecipientsTile() {
  const list = useRecipients();
  const add = useAddRecipient();
  const setActive = useSetRecipientActive();
  const setEvents = useSetRecipientEvents();
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
    <SettingsTile
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
      {(add.error || setActive.error || setEvents.error) && (
        <FormMessage tone="error">
          {(add.error ?? setActive.error ?? setEvents.error)?.message}
        </FormMessage>
      )}
      {list.data && list.data.length === 0 && <p className="text-neutral-700">Zatiaľ nikto.</p>}
      <ul className="flex flex-col">
        {(list.data ?? []).map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-neutral-200 py-2 last:border-b-0"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="break-all">{r.email}</span>
              {NOTIFICATION_EVENTS.map((ev) => {
                const id = `recipient-${r.id}-${ev.value}`;
                const on = (r.event_types ?? []).includes(ev.value);
                return (
                  <label
                    key={ev.value}
                    htmlFor={id}
                    className="flex items-center gap-2 text-[13px] text-neutral-700"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      className="accent-navy size-4"
                      checked={on}
                      disabled={setEvents.isPending}
                      onChange={() =>
                        setEvents.mutate({
                          id: r.id,
                          event_types: on
                            ? (r.event_types ?? []).filter((e) => e !== ev.value)
                            : [...(r.event_types ?? []), ev.value],
                        })
                      }
                    />
                    {ev.label}
                  </label>
                );
              })}
            </span>
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
        Odosielanie e-mailov pribudne vo fáze 8; teraz sa ukladá, kto čo chce dostávať.
      </p>
    </SettingsTile>
  );
}
