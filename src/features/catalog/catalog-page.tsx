"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RequireRole } from "@/core/auth/require-role";
import { RecordHistoryTile } from "@/core/record-history";
import type { AuditEntry } from "@/ui/audit-timeline";
import { ChipGroup } from "@/ui/chips";
import { BentoGrid } from "@/ui/tile";
import { ItemsTab } from "./components/items-tab";
import { PackagesTab } from "./components/packages-tab";
import { RatesTab } from "./components/rates-tab";
import { ResourcesTab } from "./components/resources-tab";
import { UnitsTab } from "./components/units-tab";
import {
  CATALOG_FIELD_LABELS,
  CATALOG_TABLE_LABELS,
  CATALOG_TABS,
  type CatalogTab,
} from "./schema";

const TAB_TABLES: Record<CatalogTab, string[]> = {
  polozky: ["catalog_items"],
  balicky: ["package_components", "catalog_items"],
  jednotky: ["units"],
  sadzby: ["labor_roles", "labor_rates"],
  zdroje: ["resources"],
};

function recordLabel(e: AuditEntry): string {
  const data = (e.new_data ?? e.old_data) as Record<string, unknown> | null;
  const name =
    typeof data?.name === "string" ? data.name : typeof data?.code === "string" ? data.code : null;
  const table = CATALOG_TABLE_LABELS[e.table_name] ?? e.table_name;
  return name ? `${table}: ${name}` : table;
}

function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: CatalogTab = CATALOG_TABS.some((t) => t.value === raw)
    ? (raw as CatalogTab)
    : "polozky";

  return (
    <div className="flex flex-col gap-4">
      <ChipGroup
        label="Časť katalógu"
        options={CATALOG_TABS}
        value={tab}
        onChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      />
      <BentoGrid className="md:auto-rows-[minmax(160px,auto)]">
        {tab === "polozky" && (
          <ItemsTab key={params.get("nova") ?? ""} openNew={params.get("nova") === "1"} />
        )}
        {tab === "balicky" && <PackagesTab />}
        {tab === "jednotky" && <UnitsTab />}
        {tab === "sadzby" && <RatesTab />}
        {tab === "zdroje" && <ResourcesTab />}
        <RecordHistoryTile
          key={tab}
          tables={TAB_TABLES[tab]}
          fieldLabels={CATALOG_FIELD_LABELS}
          recordLabel={recordLabel}
        />
      </BentoGrid>
    </div>
  );
}

export function CatalogPage() {
  return (
    <RequireRole role="admin">
      <Catalog />
    </RequireRole>
  );
}
