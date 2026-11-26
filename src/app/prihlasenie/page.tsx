"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { IDLE_SIGNED_OUT_KEY } from "@/core/auth/idle";
import { useForm } from "react-hook-form";
import { signInSchema, type SignInValues } from "@/core/auth/schemas";
import { authErrorMessage, type AuthStatus } from "@/core/auth/status";
import { useAuthStep } from "@/core/auth/use-auth-step";
import { AuthSkeleton } from "@/core/auth/require-aal2";
import { getSupabase } from "@/core/supabase/client";
import { AuthCard } from "@/ui/auth-card";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";

const SERVES: readonly AuthStatus[] = ["signed-out"];

export default function SignInPage() {
  const { active, refresh } = useAuthStep(SERVES);
  const [error, setError] = useState<string | null>(null);
  // shown once after an automatic sign-out for inactivity
  const [idleNotice] = useState(
    () =>
      typeof window !== "undefined" && window.sessionStorage.getItem(IDLE_SIGNED_OUT_KEY) === "1",
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const submit = handleSubmit(async (values) => {
    setError(null);
    const { error: e } = await getSupabase().auth.signInWithPassword(values);
    if (e) {
      setError(authErrorMessage(e));
      return;
    }
    window.sessionStorage.removeItem(IDLE_SIGNED_OUT_KEY);
    // the step hook moves on to the TOTP prompt / enrolment
    await refresh();
  });

  if (!active) return <AuthSkeleton />;

  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;
  return (
    <AuthCard
      title="Prihlásenie"
      description="Interný systém Add Value Agency. Po zadaní hesla budete potrebovať kód z overovacej aplikácie."
      footer="Účty zakladá administrátor. Ak ste zabudli heslo alebo stratili telefón, kontaktujte druhého administrátora."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {idleNotice && (
          <FormMessage tone="success">
            Boli ste odhlásený pre nečinnosť. Prihláste sa znova.
          </FormMessage>
        )}
        <Field id="email" label="E-mail" error={emailError}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            invalid={!!emailError}
            aria-describedby={describedBy("email", { error: emailError })}
            {...register("email")}
          />
        </Field>
        <Field id="password" label="Heslo" error={passwordError}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={!!passwordError}
            aria-describedby={describedBy("password", { error: passwordError })}
            {...register("password")}
          />
        </Field>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Prihlasujem…" : "Pokračovať"}
        </Button>
      </form>
    </AuthCard>
  );
}
