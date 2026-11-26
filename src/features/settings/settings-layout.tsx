"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RequireRole } from "@/core/auth/require-role";
import { findSettingsPage, SETTINGS_GROUPS, SETTINGS_HOME } from "@/core/navigation";
import { RecordHistoryTile } from "@/core/record-history";
import { cn } from "@/ui/cn";
import { Select } from "@/ui/field";
import { recordLabel } from "./components/audit-tile";
import { FIELD_LABELS } from "./schema";

/** Secondary menu of the settings (desktop): groups with their pages, active page highlighted. */
function SettingsNav({ current }: { current: string }) {
  return (
    <nav aria-label="Sekcie nastavení" className="flex flex-col gap-4">
      <Link
        href={SETTINGS_HOME}
        aria-current={current === SETTINGS_HOME ? "page" : undefined}
        className={cn(
          "rounded-lg px-3 py-1.5 text-[15px] font-medium",
          current === SETTINGS_HOME ? "bg-navy text-white" : "text-ink hover:bg-white",
        )}
      >
        Prehľad nastavení
      </Link>
      {SETTINGS_GROUPS.map((g) => (
        <div key={g.key} className="flex flex-col gap-0.5">
          <p className="px-3 text-[13px] leading-5 font-semibold tracking-[0.04em] text-neutral-500 uppercase">
            {g.label}
          </p>
          {g.pages.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={current === p.href ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[15px]",
                current === p.href ? "bg-navy font-medium text-white" : "text-ink hover:bg-white",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Mobile: a select of the section instead of the side menu. */
function SettingsSelect({ current }: { current: string }) {
  const router = useRouter();
  return (
    <div className="md:hidden">
      <label htmlFor="settings-section" className="text-[13px] font-medium text-neutral-700">
        Sekcia nastavení
      </label>
      <Select id="settings-section" value={current} onChange={(e) => router.push(e.target.value)}>
        <option value={SETTINGS_HOME}>Prehľad nastavení</option>
        {SETTINGS_GROUPS.map((g) => (
          <optgroup key={g.key} label={g.label}>
            {g.pages.map((p) => (
              <option key={p.href} value={p.href}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}

/**
 * Settings layout (DESIGN_SYSTEM §6.5): secondary menu on the left, the page in the middle,
 * the change history of that section always at the bottom (principle 8).
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/?$/, "/");
  const page = findSettingsPage(normalized);
  const current = page?.href ?? SETTINGS_HOME;
  const history = page && page.historyTables.length > 0 ? page.historyTables : null;

  return (
    <RequireRole role="admin">
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        <aside className="no-print hidden md:sticky md:top-4 md:block">
          <SettingsNav current={current} />
        </aside>
        <SettingsSelect current={current} />
        <div className="flex min-w-0 flex-col gap-4">
          {page && (
            <div data-testid="settings-page-title">
              <p className="text-[13px] text-neutral-700">{page.group.label}</p>
              <h2 className="text-navy text-[20px] leading-7 font-semibold">{page.label}</h2>
            </div>
          )}
          {children}
          {history && (
            <RecordHistoryTile
              key={current}
              tables={history}
              fieldLabels={FIELD_LABELS}
              recordLabel={recordLabel}
            />
          )}
        </div>
      </div>
    </RequireRole>
  );
}
