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
import { UsersTile, useUsers } from "./components/users-tile";
import { useTaxBrackets } from "./reporting-api";

/** Settings pages: forms grow with their content (rows are not fixed to 160 px). */
const GRID = "md:auto-rows-[minmax(160px,auto)]";

function Grid({ children }: { children: ReactNode }) {
  return <BentoGrid className={GRID}>{children}</BentoGrid>;
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

/** Status badges of a group on the overview (what needs attention). */
function useGroupStatus(): Record<string, { label: string; tone: StatusTone }[]> {
  const company = useCompany();
  const users = useUsers();
  const tax = useTaxBrackets();
  const c = company.data;
  const firma: { label: string; tone: StatusTone }[] = [];
  if (company.data !== undefined) {
    if (!c?.logo_document_id) firma.push({ label: "Logo chýba", tone: "warning" });
    if (!c?.ico || c.ico === "TODO" || !c?.iban)
      firma.push({ label: "Údaje neúplné", tone: "warning" });
    if (firma.length === 0) firma.push({ label: "V poriadku", tone: "success" });
  }
  const weak = (users.data ?? []).filter((u) => u.verified_totp_factors < 2).length;
  return {
    firma,
    pouzivatelia: users.data
      ? [
          { label: `${users.data.length} používatelia`, tone: "neutral" },
          ...(weak > 0
            ? [{ label: `${weak} bez záložného faktora`, tone: "warning" as StatusTone }]
            : []),
        ]
      : [],
    ai: [{ label: "Pripravujeme", tone: "neutral" }],
    reporting:
      tax.data && tax.data.length === 0 ? [{ label: "Pásma dane nezadané", tone: "warning" }] : [],
    data: [{ label: "Pripravujeme", tone: "neutral" }],
  };
}

/** /nastavenia/ – bento tiles of the sections with a description and their state. */
export function SettingsOverview() {
  const status = useGroupStatus();
  return (
    <Grid>
      {SETTINGS_GROUPS.map((g) => (
        <Tile key={g.key} size="M" title={g.label}>
          <div className="flex h-full flex-col gap-2">
            <p className="text-[15px] text-neutral-700">{g.description}</p>
            {(status[g.key] ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {status[g.key].map((s) => (
                  <StatusBadge key={s.label} label={s.label} tone={s.tone} />
                ))}
              </div>
            )}
            <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1">
              {g.pages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="text-navy text-[15px] font-medium hover:underline">
                    {p.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Tile>
      ))}
    </Grid>
  );
}
