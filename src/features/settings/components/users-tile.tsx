"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/core/auth/auth-provider";
import { TotpEnroll } from "@/core/auth/totp-forms";
import { formatDateTime } from "@/core/format";
import { getSupabase } from "@/core/supabase/client";
import { throwDb } from "@/core/supabase/errors";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { FormMessage } from "@/ui/field";
import { StatusBadge, type StatusTone } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import { keys } from "../api";

/** Recommended: every admin has two TOTP factors (phone + backup). */
export function factorBadge(count: number): { label: string; tone: StatusTone } {
  if (count >= 2) return { label: `${count} faktory – OK`, tone: "success" };
  if (count === 1) return { label: "1 faktor – pridajte zálohu", tone: "warning" };
  return { label: "Bez 2FA", tone: "danger" };
}

const RESET_ERRORS: Record<number, string> = {
  400: "Vlastný druhý faktor nemôžete resetovať. Požiadajte druhého administrátora.",
  401: "Prihlásenie vypršalo. Prihláste sa znova.",
  403: "Na reset nemáte oprávnenie (potrebný administrátor s overeným druhým faktorom).",
  404: "Používateľ neexistuje.",
};

export function useUsers() {
  return useQuery({
    queryKey: keys.users,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("admin_list_users");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

function useResetMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await getSupabase().functions.invoke("admin-mfa-reset", {
        body: { user_id: userId },
      });
      if (error) {
        const status = (error as { context?: Response }).context?.status ?? 0;
        throw new Error(RESET_ERRORS[status] ?? "Reset sa nepodaril. Skúste to znova.");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.users });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

export function UsersTile() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const users = useUsers();
  const reset = useResetMfa();
  const [enrolling, setEnrolling] = useState(false);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Tile
      size="L"
      title="Používatelia a 2FA"
      action={
        !enrolling && (
          <Button variant="secondary" onClick={() => setEnrolling(true)}>
            Pridať záložný faktor
          </Button>
        )
      }
    >
      {enrolling ? (
        <div className="flex flex-col gap-4">
          <p className="text-neutral-700">
            Záložný faktor (napr. druhý telefón) vám umožní prihlásiť sa aj pri strate hlavného
            telefónu.
          </p>
          <TotpEnroll
            defaultName="Záložný telefón"
            onDone={async () => {
              setEnrolling(false);
              setNotice("Záložný faktor je zaregistrovaný.");
              await qc.invalidateQueries({ queryKey: keys.users });
            }}
          />
          <Button variant="ghost" className="self-start" onClick={() => setEnrolling(false)}>
            Zrušiť
          </Button>
        </div>
      ) : (
        <>
          {users.error && <FormMessage tone="error">{users.error.message}</FormMessage>}
          {notice && <FormMessage tone="success">{notice}</FormMessage>}
          <ul className="flex flex-col">
            {(users.data ?? []).map((u) => {
              const badge = factorBadge(u.verified_totp_factors);
              const name = u.full_name || u.email || "Používateľ";
              const isMe = u.user_id === userId;
              return (
                <li
                  key={u.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      {name}
                      {isMe && <span className="text-neutral-500"> (vy)</span>}
                    </span>
                    <span className="text-[13px] text-neutral-500">
                      {u.email} · {u.roles.join(", ") || "bez roly"}
                      {u.last_sign_in_at && <> · naposledy {formatDateTime(u.last_sign_in_at)}</>}
                    </span>
                  </div>
                  <span className="flex items-center gap-2">
                    <StatusBadge label={badge.label} tone={badge.tone} />
                    {!isMe && u.verified_totp_factors > 0 && (
                      <Button variant="ghost" onClick={() => setTarget({ id: u.user_id, name })}>
                        Resetovať 2FA
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {reset.error && <FormMessage tone="error">{reset.error.message}</FormMessage>}
        </>
      )}

      <ConfirmDialog
        open={!!target}
        title="Resetovať druhý faktor?"
        confirmLabel="Resetovať 2FA"
        busy={reset.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() =>
          target &&
          reset.mutate(target.id, {
            onSuccess: () => setNotice(`2FA používateľa ${target.name} bolo resetované.`),
            onSettled: () => setTarget(null),
          })
        }
      >
        Používateľovi <strong>{target?.name}</strong> sa odstránia všetky overovacie aplikácie. Pri
        ďalšom prihlásení si musí zaregistrovať nový telefón. Použite len pri strate alebo výmene
        telefónu – overte si to s ním osobne alebo telefonicky. Akcia sa zapíše do histórie zmien.
      </ConfirmDialog>
    </Tile>
  );
}
