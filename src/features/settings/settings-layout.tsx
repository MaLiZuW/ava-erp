"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RequireRole } from "@/core/auth/require-role";
import { findSettingsPage, SETTINGS_HOME } from "@/core/navigation";
import { RecordHistoryTile } from "@/core/record-history";
import { useShellHeader, useShellSidebar } from "@/ui/shell-context";
import { recordLabel } from "./components/audit-tile";
import { SettingsPageContext } from "./components/settings-tile";
import { HISTORY_FILTERS } from "./history-filters";
import { FIELD_LABELS } from "./schema";
import { SettingsSidebar } from "./settings-sidebar";

/**
 * Settings mode (DESIGN_SYSTEM §6.5, owner's points 20–21): the left panel switches to the
 * settings menu, the sticky header shows "Nastavenia / Group", the title, one line of
 * description and the primary button; content has one width (max 960 px); the history of
 * the section is always at the bottom.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const normalized = usePathname().replace(/\/?$/, "/");
  const page = findSettingsPage(normalized);
  useShellSidebar(<SettingsSidebar />);
  useShellHeader(
    page
      ? {
          breadcrumb: [{ label: "Nastavenia", href: SETTINGS_HOME }, { label: page.group.label }],
          title: page.label,
          description: page.description,
          back: { label: "Nastavenia", href: SETTINGS_HOME },
        }
      : {
          title: "Nastavenia",
          description:
            "Firma, bezpečnosť, systém, AI, reporting a dáta – čo treba doplniť, vidno na dlaždiciach.",
        },
  );
  const history = page && page.historyTables.length > 0 ? page.historyTables : null;

  return (
    <RequireRole role="admin">
      <SettingsPageContext value={!!page}>
        <div className="flex w-full max-w-[960px] flex-col gap-4">
          {children}
          {history && (
            <RecordHistoryTile
              key={page!.href}
              tables={history}
              fieldLabels={FIELD_LABELS}
              recordLabel={recordLabel}
              filter={HISTORY_FILTERS[page!.href]}
            />
          )}
        </div>
      </SettingsPageContext>
    </RequireRole>
  );
}
