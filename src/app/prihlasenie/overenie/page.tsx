"use client";

import { useEffect, useId, useState } from "react";
import { AuthSkeleton } from "@/core/auth/require-aal2";
import { authErrorMessage, type AuthStatus } from "@/core/auth/status";
import { TotpCodeForm } from "@/core/auth/totp-forms";
import { useAuthStep } from "@/core/auth/use-auth-step";
import { getSupabase } from "@/core/supabase/client";
import { AuthCard } from "@/ui/auth-card";
import { Button } from "@/ui/button";
import { Field, Select } from "@/ui/field";

const SERVES: readonly AuthStatus[] = ["needs-verify"];

interface Factor {
  id: string;
  name: string;
}

export default function VerifyPage() {
  const { active, refresh, signOut } = useAuthStep(SERVES);
  const selectId = useId();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [factorId, setFactorId] = useState<string>("");

  useEffect(() => {
    if (!active) return;
    void getSupabase()
      .auth.mfa.listFactors()
      .then(({ data }) => {
        const list = (data?.totp ?? [])
          .filter((f) => f.status === "verified")
          .map((f, i) => ({ id: f.id, name: f.friendly_name || `Zariadenie ${i + 1}` }));
        setFactors(list);
        setFactorId(list[0]?.id ?? "");
      });
  }, [active]);

  if (!active || factors === null) return <AuthSkeleton />;

  const verify = async (code: string) => {
    const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return authErrorMessage(error);
    await refresh();
    return null;
  };

  return (
    <AuthCard
      title="Overenie"
      description="Zadajte 6-miestny kód z overovacej aplikácie v telefóne."
      footer={
        <Button variant="ghost" onClick={() => void signOut()} className="-ml-4">
          Odhlásiť sa a prihlásiť iným účtom
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {factors.length > 1 && (
          <Field id={selectId} label="Zariadenie">
            <Select id={selectId} value={factorId} onChange={(e) => setFactorId(e.target.value)}>
              {factors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <TotpCodeForm onCode={verify} />
      </div>
    </AuthCard>
  );
}
