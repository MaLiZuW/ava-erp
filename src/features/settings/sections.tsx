"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SETTINGS_GROUPS } from "@/core/navigation";
import { EmptyState } from "@/ui/empty-state";
import { FormMessage } from "@/ui/field";
import { StatusBadge, type StatusTone } from "@/ui/status-badge";
import { BentoGrid, Tile } from "@/ui/tile";
import { useCompany } from "./api";
import { AuditTile } from "./components/audit-tile";
import { CompanyTile } from "./components/company-tile";
import { FeatureFlagsTile } from "./components/feature-flags-tile";
import { LogoTile } from "./components/logo-tile";
import { RecipientsTile } from "./components/recipients-tile";
import { CapacityCalendarTile } from "./components/reporting/capacity-calendar-tile";
import { KpiTargetsTile } from "./components/reporting/kpi-targets-tile";
import { OverheadTile } from "./components/reporting/overhead-tile";
import { TaxBracketsTile } from "./components/reporting/tax-brackets-tile";
import { SystemSettingsTile } from "./components/system-settings-tile";
import { UsersTile } from "./components/users-tile";
import { useSettingsStatus } from "./settings-status";

/** Settings pages: one column of full-width tiles inside the 960 px content (point 21). */
function Grid({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** The company record is needed by the company data and the logo. */
function WithCompany({
  children,
}: {
  children: (c: ReturnType<typeof useCompany>["data"]) => ReactNode;
}) {
  const company = useCompany();
  if (company.isPending) {
    return (
      <Grid>
        <Tile size="XL">
          <div aria-hidden className="flex animate-pulse flex-col gap-3">
            <div className="bg-canvas h-10 rounded-xl" />
            <div className="bg-canvas h-10 rounded-xl" />
          </div>
        </Tile>
      </Grid>
    );
  }
  if (company.error) return <FormMessage tone="error">{company.error.message}</FormMessage>;
  return <>{children(company.data)}</>;
}

export function CompanySection() {
  return (
    <WithCompany>
      {/* key: the form re-initialises after the record is created/changed elsewhere */}
      {(c) => (
        <Grid>
          <CompanyTile key={c?.updated_at ?? "new"} company={c ?? null} />
        </Grid>
      )}
    </WithCompany>
  );
}

export function LogoSection() {
  return (
    <WithCompany>
      {(c) => (
        <Grid>
          <LogoTile company={c ?? null} />
        </Grid>
      )}
    </WithCompany>
  );
}

export const UsersSection = () => (
  <Grid>
    <UsersTile />
  </Grid>
);
export const SystemSection = () => (
  <Grid>
    <SystemSettingsTile />
  </Grid>
);
export const FlagsSection = () => (
  <Grid>
    <FeatureFlagsTile />
  </Grid>
);
export const RecipientsSection = () => (
  <Grid>
    <RecipientsTile />
  </Grid>
);
export const OverheadSection = () => (
  <Grid>
    <OverheadTile />
  </Grid>
);
export const TaxSection = () => (
  <Grid>
    <TaxBracketsTile />
  </Grid>
);
export const CapacitySection = () => (
  <Grid>
    <CapacityCalendarTile />
  </Grid>
);
export const KpiSection = () => (
  <Grid>
    <KpiTargetsTile />
  </Grid>
);
export const HistorySection = () => (
  <Grid>
    <AuditTile />
  </Grid>
);

function Prepared({ title, text }: { title: string; text: string }) {
  return (
    <Grid>
      <Tile size="L" title={title}>
        <EmptyState title="Pripravujeme" description={text} />
      </Tile>
    </Grid>
  );
}
export const AiSection = () => (
  <Prepared
    title="AI"
    text="Poskytovateľ, API kľúč (len na zápis), funkcie a rozpočet s poistkou – pribudne v bloku L."
  />
);
export const DataSection = () => (
  <Prepared
    title="Na overenie a číselníky"
    text="Periodické overovanie aktuálnosti dát a číselníky – pribudne v blokoch I, J a K."
  />
);

/** /nastavenia/ – tiles of the sections in the order of the menu, with their state (point 21). */
export function SettingsOverview() {
  const status = useSettingsStatus();
  const prepared = new Set(["ai", "data"]);
  return (
    <BentoGrid className="md:auto-rows-[minmax(160px,auto)]">
      {SETTINGS_GROUPS.map((g) => {
        const badges = g.pages
          .filter((p) => status[p.href])
          .map((p) => ({ label: `${p.label}: ${status[p.href].text}`, tone: status[p.href].tone }));
        if (prepared.has(g.key))
          badges.push({ label: "Pripravujeme", tone: "neutral" as StatusTone });
        return (
          <Tile key={g.key} size="M" title={g.label}>
            <div className="flex h-full flex-col gap-2">
              <p className="text-[15px] text-neutral-700">{g.description}</p>
              <div className="flex min-h-6 flex-wrap gap-2">
                {badges.map((b) => (
                  <StatusBadge key={b.label} label={b.label} tone={b.tone} />
                ))}
                {badges.length === 0 && status.loaded && !prepared.has(g.key) && (
                  <StatusBadge label="V poriadku" tone="success" />
                )}
              </div>
              <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1">
                {g.pages.map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      className="text-navy text-[15px] font-medium hover:underline"
                    >
                      {p.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Tile>
        );
      })}
    </BentoGrid>
  );
}
