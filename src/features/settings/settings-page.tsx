"use client";

import { RequireRole } from "@/core/auth/require-role";
import { FormMessage } from "@/ui/field";
import { BentoGrid, Tile } from "@/ui/tile";
import { useCompany } from "./api";
import { AuditTile } from "./components/audit-tile";
import { CompanyTile } from "./components/company-tile";
import { FeatureFlagsTile } from "./components/feature-flags-tile";
import { LogoTile } from "./components/logo-tile";
import { RecipientsTile } from "./components/recipients-tile";
import { SystemSettingsTile } from "./components/system-settings-tile";
import { UsersTile } from "./components/users-tile";

/** Settings grid: forms grow with their content (rows are not fixed to 160 px here). */
const GRID = "md:auto-rows-[minmax(160px,auto)]";

function SettingsContent() {
  const company = useCompany();

  if (company.isPending) {
    return (
      <BentoGrid className={GRID}>
        <Tile size="XL" title="Firma – údaje na doklady">
          <div aria-hidden className="flex animate-pulse flex-col gap-3">
            <div className="bg-canvas h-10 rounded-xl" />
            <div className="bg-canvas h-10 rounded-xl" />
            <div className="bg-canvas h-10 rounded-xl" />
          </div>
        </Tile>
      </BentoGrid>
    );
  }
  if (company.error) {
    return <FormMessage tone="error">{company.error.message}</FormMessage>;
  }

  return (
    <BentoGrid className={GRID}>
      {/* key: the form re-initialises after the record is created/changed elsewhere */}
      <CompanyTile key={company.data?.updated_at ?? "new"} company={company.data ?? null} />
      <LogoTile company={company.data ?? null} />
      <UsersTile />
      <SystemSettingsTile />
      <FeatureFlagsTile />
      <RecipientsTile />
      <AuditTile />
    </BentoGrid>
  );
}

export function SettingsPage() {
  return (
    <RequireRole role="admin">
      <SettingsContent />
    </RequireRole>
  );
}
