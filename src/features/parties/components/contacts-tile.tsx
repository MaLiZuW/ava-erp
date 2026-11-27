"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/ui/button";
import { Checkbox, describedBy, Field, FormMessage, Input } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import { EmptyState } from "@/ui/empty-state";
import { useContacts, useSaveContact, useSetContactActive, type Contact } from "../api";
import {
  CONTACT_PRIVACY_NOTE,
  contactSchema,
  type ContactInput,
  type ContactOutput,
  type PartyKind,
} from "../schema";

const toInput = (c: Contact | null): ContactInput => ({
  full_name: c?.full_name ?? "",
  position: c?.position ?? "",
  email: c?.email ?? "",
  phone: c?.phone ?? "",
  is_primary: c?.is_primary ?? false,
});

const FIELDS: {
  name: "full_name" | "position" | "email" | "phone";
  label: string;
  type?: string;
}[] = [
  { name: "full_name", label: "Meno alebo označenie" },
  { name: "position", label: "Pozícia / oddelenie" },
  { name: "email", label: "E-mail", type: "email" },
  { name: "phone", label: "Telefón", type: "tel" },
];

function ContactForm({
  kind,
  partyId,
  contact,
  onDone,
}: {
  kind: PartyKind;
  partyId: string;
  contact: Contact | null;
  onDone: () => void;
}) {
  const save = useSaveContact(kind, partyId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput, unknown, ContactOutput>({
    resolver: zodResolver(contactSchema),
    defaultValues: toInput(contact),
  });
  const submit = handleSubmit(async (values) => {
    const ok = await save
      .mutateAsync({ id: contact?.id ?? null, values })
      .then(() => true)
      .catch(() => false);
    if (ok) onDone();
  });
  const base = `contact-${contact?.id ?? "new"}`;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={contact ? "Úprava kontaktu" : "Nový kontakt"}
      className="bg-canvas/50 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4"
    >
      <p data-testid="contact-privacy-note" className="text-[13px] leading-5 text-neutral-700">
        {CONTACT_PRIVACY_NOTE}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FIELDS.map((f) => {
          const id = `${base}-${f.name}`;
          const err = errors[f.name]?.message;
          return (
            <Field key={f.name} id={id} label={f.label} error={err}>
              <Input
                id={id}
                type={f.type}
                invalid={!!err}
                aria-describedby={describedBy(id, { error: err })}
                {...register(f.name)}
              />
            </Field>
          );
        })}
      </div>
      <Checkbox label="Hlavný kontakt" {...register("is_primary")} />
      {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Ukladám…" : "Uložiť kontakt"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </form>
  );
}

/** Contacts of one customer / supplier. Inactive contacts stay in the history (soft delete). */
export function ContactsTile({ kind, partyId }: { kind: PartyKind; partyId: string }) {
  const contacts = useContacts(kind, partyId);
  const setActive = useSetContactActive(kind);
  const [editing, setEditing] = useState<Contact | "new" | null>(null);

  return (
    <Tile
      size="L"
      title="Kontakty"
      className="md:row-span-3"
      action={
        editing === null ? (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            Pridať kontakt
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {editing !== null && (
          <ContactForm
            key={editing === "new" ? "new" : editing.id}
            kind={kind}
            partyId={partyId}
            contact={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
        {contacts.error && <FormMessage tone="error">{contacts.error.message}</FormMessage>}
        {setActive.error && <FormMessage tone="error">{setActive.error.message}</FormMessage>}
        {contacts.data?.length === 0 && editing === null && (
          <EmptyState
            title="Zatiaľ bez kontaktu"
            description="Pridajte napríklad všeobecný firemný kontakt (info@, objednávky@)."
          />
        )}
        <ul className="flex flex-col divide-y divide-neutral-200">
          {(contacts.data ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {c.full_name}
                  {c.is_primary && <StatusBadge label="Hlavný" tone="info" />}
                  {!c.is_active && <StatusBadge label="Neaktívny" />}
                </p>
                {c.position && <p className="text-[13px] text-neutral-700">{c.position}</p>}
                <p className="text-[13px] break-all text-neutral-700">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  onClick={() => setEditing(c)}
                  aria-label={`Upraviť ${c.full_name}`}
                >
                  Upraviť
                </Button>
                <Button
                  variant="ghost"
                  disabled={setActive.isPending}
                  onClick={() => setActive.mutate({ id: c.id, is_active: !c.is_active })}
                  aria-label={`${c.is_active ? "Deaktivovať" : "Aktivovať"} ${c.full_name}`}
                >
                  {c.is_active ? "Deaktivovať" : "Aktivovať"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Tile>
  );
}
