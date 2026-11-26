"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthSkeleton } from "@/core/auth/require-aal2";
import { newPasswordSchema, PASSWORD_MIN, type NewPasswordValues } from "@/core/auth/schemas";
import { authErrorMessage, MUST_SET_PASSWORD_KEY, type AuthStatus } from "@/core/auth/status";
import { useAuthStep } from "@/core/auth/use-auth-step";
import { getSupabase } from "@/core/supabase/client";
import { AuthCard } from "@/ui/auth-card";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input } from "@/ui/field";

const SERVES: readonly AuthStatus[] = ["needs-password"];
const HINT = `Aspoň ${PASSWORD_MIN} znakov. Odporúčame dlhú vetu alebo heslo zo správcu hesiel.`;

export default function NewPasswordPage() {
  const { active, refresh, signOut } = useAuthStep(SERVES);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) });

  const submit = handleSubmit(async ({ password }) => {
    setError(null);
    const { error: e } = await getSupabase().auth.updateUser({ password });
    if (e) {
      // a user who already has a second factor must verify it first (Supabase requires aal2)
      if (e.code === "insufficient_aal") window.sessionStorage.removeItem(MUST_SET_PASSWORD_KEY);
      setError(authErrorMessage(e));
      if (e.code === "insufficient_aal") await refresh();
      return;
    }
    window.sessionStorage.removeItem(MUST_SET_PASSWORD_KEY);
    await refresh();
  });

  if (!active) return <AuthSkeleton />;

  const pErr = errors.password?.message;
  const cErr = errors.confirm?.message;
  return (
    <AuthCard
      title="Nastavenie hesla"
      description="Zvoľte si heslo k účtu. V ďalšom kroku zaregistrujete overovaciu aplikáciu."
      footer={
        <Button variant="ghost" onClick={() => void signOut()} className="-ml-4">
          Zrušiť a odhlásiť sa
        </Button>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id="password" label="Nové heslo" hint={HINT} error={pErr}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            invalid={!!pErr}
            aria-describedby={describedBy("password", { hint: HINT, error: pErr })}
            {...register("password")}
          />
        </Field>
        <Field id="confirm" label="Zopakujte heslo" error={cErr}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            invalid={!!cErr}
            aria-describedby={describedBy("confirm", { error: cErr })}
            {...register("confirm")}
          />
        </Field>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Ukladám…" : "Uložiť heslo"}
        </Button>
      </form>
    </AuthCard>
  );
}
