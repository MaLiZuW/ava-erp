"use client";

import { useState } from "react";
import { parseInactivityMinutes } from "@/core/auth/idle";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import { SettingsTile } from "./settings-tile";
import { useSaveSetting, useSystemSettings } from "../api";
import { SYSTEM_SETTINGS } from "../schema";

const KEY = "inactivity_minutes" as const;
const FORM_ID = "system-settings-form";

export function SystemSettingsTile() {
  const settings = useSystemSettings();
  const save = useSaveSetting();
  const def = SYSTEM_SETTINGS[KEY];
  const current = parseInactivityMinutes(settings.data?.[KEY]);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const value = draft ?? String(current);
  const id = "setting-inactivity";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const parsed = def.schema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Neplatná hodnota.");
      return;
    }
    setError(null);
    save.mutate(
      { key: KEY, value: parsed.data },
      {
        onSuccess: () => {
          setDraft(null);
          setSaved(true);
        },
      },
    );
  };

  return (
    <SettingsTile
      size="M"
      title="Systém"
      action={
        <Button
          type="submit"
          form={FORM_ID}
          variant="secondary"
          disabled={save.isPending || draft === null}
        >
          Uložiť
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field id={id} label={def.label} hint={def.hint} error={error ?? undefined}>
          <Input
            id={id}
            inputMode="numeric"
            className="max-w-[160px] tabular-nums"
            value={value}
            invalid={!!error}
            aria-describedby={describedBy(id, { hint: def.hint, error: error ?? undefined })}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>
        {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
        {saved && (
          <FormMessage tone="success">Uložené. Platí od ďalšieho načítania stránky.</FormMessage>
        )}
      </form>
    </SettingsTile>
  );
}
