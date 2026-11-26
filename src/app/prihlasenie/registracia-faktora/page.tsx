"use client";

import { AuthSkeleton } from "@/core/auth/require-aal2";
import type { AuthStatus } from "@/core/auth/status";
import { TotpEnroll } from "@/core/auth/totp-forms";
import { useAuthStep } from "@/core/auth/use-auth-step";
import { AuthCard } from "@/ui/auth-card";
import { Button } from "@/ui/button";

const SERVES: readonly AuthStatus[] = ["needs-enroll"];

export default function EnrollPage() {
  const { active, refresh, signOut } = useAuthStep(SERVES);
  if (!active) return <AuthSkeleton />;

  return (
    <AuthCard
      title="Druhý faktor"
      description="Prístup do systému je chránený overovacou aplikáciou v telefóne. Registrácia je povinná a robí sa raz."
      footer={
        <>
          <p className="mb-2">
            Odporúčanie: po prihlásení si v Nastaveniach pridajte aj záložný faktor (druhý telefón).
          </p>
          <Button variant="ghost" onClick={() => void signOut()} className="-ml-4">
            Odhlásiť sa
          </Button>
        </>
      }
    >
      <TotpEnroll
        onDone={async () => {
          await refresh();
        }}
      />
    </AuthCard>
  );
}
