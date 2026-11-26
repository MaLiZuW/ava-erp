"use client";

import { useEffect, useId, type ReactNode } from "react";
import { Button } from "./button";

/** Confirmation for critical actions – clear text of the consequence (DESIGN_SYSTEM §7). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-[480px] rounded-[20px] border border-neutral-200 bg-white p-6"
      >
        <h2 id={titleId} className="text-navy text-[20px] leading-7 font-semibold">
          {title}
        </h2>
        <div id={descId} className="mt-2 text-neutral-700">
          {children}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" autoFocus onClick={onCancel} disabled={busy}>
            Zrušiť
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="bg-danger hover:bg-danger/90">
            {busy ? "Pracujem…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
