"use client";

import { FormMessage } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { SettingsTile } from "./settings-tile";
import { useFeatureFlags, useToggleFlag } from "../api";

/** Slovak names of the known flags (the note column stays technical). */
const FLAG_LABELS: Record<string, string> = {
  service_cnc: "Servis a diely CNC (typ zákazky SERVICE)",
  email_sync: "Synchronizácia e-mailovej schránky",
  ai_legal_summary: "AI zhrnutie zmien legislatívy",
  ai_text_drafts: "AI návrhy textov",
};

export function FeatureFlagsTile() {
  const flags = useFeatureFlags();
  const toggle = useToggleFlag();

  return (
    <SettingsTile size="L" title="Funkcie">
      <ul className="flex flex-col">
        {(flags.data ?? []).map((f) => {
          const id = `flag-${f.key}`;
          return (
            <li
              key={f.key}
              className="flex items-center justify-between gap-4 border-b border-neutral-200 py-3 last:border-b-0"
            >
              <label htmlFor={id} className="flex flex-col">
                <span className="text-[15px] font-medium">{FLAG_LABELS[f.key] ?? f.key}</span>
                <span className="text-[13px] text-neutral-500">{f.key}</span>
              </label>
              <span className="flex items-center gap-3">
                <StatusBadge
                  label={f.enabled ? "Zapnuté" : "Vypnuté"}
                  tone={f.enabled ? "success" : "neutral"}
                />
                <input
                  id={id}
                  type="checkbox"
                  role="switch"
                  aria-checked={f.enabled}
                  checked={f.enabled}
                  disabled={toggle.isPending}
                  onChange={(e) => toggle.mutate({ key: f.key, enabled: e.target.checked })}
                  className="accent-navy size-5"
                />
              </span>
            </li>
          );
        })}
      </ul>
      {toggle.error && <FormMessage tone="error">{toggle.error.message}</FormMessage>}
    </SettingsTile>
  );
}
