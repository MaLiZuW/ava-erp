"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { getSupabase } from "@/core/supabase/client";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";
import {
  factorNameSchema,
  totpCodeSchema,
  type FactorNameValues,
  type TotpCodeValues,
} from "./schemas";
import { authErrorMessage } from "./status";

/** 6-digit code input. `onCode` returns an error message or null on success. */
export function TotpCodeForm({
  onCode,
  submitLabel = "Overiť",
  autoFocus = true,
}: {
  onCode: (code: string) => Promise<string | null>;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<TotpCodeValues, unknown, { code: string }>({ resolver: zodResolver(totpCodeSchema) });

  const submit = handleSubmit(async ({ code }) => {
    setError(null);
    const err = await onCode(code);
    if (err) {
      setError(err);
      reset({ code: "" });
      setFocus("code");
    }
  });

  const fieldError = errors.code?.message;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={id} label="Kód z aplikácie (6 číslic)" error={fieldError}>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          autoFocus={autoFocus}
          className="text-[20px] tracking-[0.3em] tabular-nums"
          invalid={!!fieldError}
          aria-describedby={describedBy(id, { error: fieldError })}
          {...register("code")}
        />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Overujem…" : submitLabel}
      </Button>
    </form>
  );
}

const NAME_HINT = "Napríklad „Telefón Vlado“ alebo „Záložný telefón“.";

type EnrollState = { factorId: string; qr: string; secret: string } | null;

/** Removes unfinished (unverified) TOTP enrolments so that a new one can start cleanly. */
async function removeUnverifiedFactors() {
  const sb = getSupabase();
  const { data } = await sb.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await sb.auth.mfa.unenroll({ factorId: f.id });
    }
  }
}

/**
 * Registers a TOTP factor: name → QR code / manual key → verification code.
 * Used at first sign-in (mandatory) and in Settings (backup factor, e.g. a second phone).
 */
export function TotpEnroll({
  defaultName = "Telefón",
  onDone,
}: {
  defaultName?: string;
  onDone: () => Promise<void> | void;
}) {
  const nameId = useId();
  const [state, setState] = useState<EnrollState>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FactorNameValues>({
    resolver: zodResolver(factorNameSchema),
    defaultValues: { name: defaultName },
  });

  const start = handleSubmit(async ({ name }) => {
    setError(null);
    await removeUnverifiedFactors();
    const { data, error: e } = await getSupabase().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: name,
      issuer: "Add Value Agency",
    });
    if (e || !data) {
      setError(
        e?.code === "mfa_factor_name_conflict"
          ? "Zariadenie s týmto názvom už máte. Zvoľte iný názov."
          : authErrorMessage(e ?? {}),
      );
      return;
    }
    setState({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  });

  const verify = async (code: string) => {
    if (!state) return "Registrácia nebola spustená.";
    const { error: e } = await getSupabase().auth.mfa.challengeAndVerify({
      factorId: state.factorId,
      code,
    });
    if (e) return authErrorMessage(e);
    await onDone();
    return null;
  };

  if (!state) {
    const nameError = errors.name?.message;
    return (
      <form onSubmit={start} noValidate className="flex flex-col gap-4">
        <Field id={nameId} label="Názov zariadenia" hint={NAME_HINT} error={nameError}>
          <Input
            id={nameId}
            autoComplete="off"
            invalid={!!nameError}
            aria-describedby={describedBy(nameId, { hint: NAME_HINT, error: nameError })}
            {...register("name")}
          />
        </Field>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Pripravujem…" : "Zobraziť QR kód"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-neutral-700">
        <li>Otvorte overovaciu aplikáciu (Google Authenticator, Microsoft Authenticator…).</li>
        <li>Naskenujte QR kód alebo zadajte kľúč ručne.</li>
        <li>Zadajte 6-miestny kód, ktorý aplikácia zobrazí.</li>
      </ol>
      <div className="flex flex-col items-start gap-3">
        {/* QR code is an SVG data URI generated by Supabase Auth; an <img> never runs scripts */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.qr}
          alt="QR kód na registráciu overovacej aplikácie"
          width={192}
          height={192}
          className="rounded-xl border border-neutral-200 bg-white p-2"
        />
        <div>
          <p className="text-[13px] leading-5 font-medium text-neutral-700">
            Kľúč na ručné zadanie
          </p>
          <code
            data-testid="totp-secret"
            className="text-ink font-mono text-[15px] break-all select-all"
          >
            {state.secret.match(/.{1,4}/g)?.join(" ")}
          </code>
        </div>
      </div>
      <TotpCodeForm onCode={verify} submitLabel="Overiť a dokončiť" autoFocus={false} />
    </div>
  );
}
