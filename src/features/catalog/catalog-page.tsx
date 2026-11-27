"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RequireRole } from "@/core/auth/require-role";
import { RecordHistoryTile } from "@/core/record-history";
import type { AuditEntry, RefResolver } from "@/ui/audit-timeline";
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
  polozky: ["catalog_items", "documents"],
  balicky: ["package_components", "catalog_items", "documents"],
  jednotky: ["units"],
  sadzby: ["labor_roles", "labor_rates"],
  technika: ["resources", "documents"],
};

/** documents of the tab only (attachments of items / equipment, not the logo or content images) */
const DOC_ENTITY: Partial<Record<CatalogTab, string>> = {
  polozky: "catalog_items",
  balicky: "catalog_items",
  technika: "resources",
};
const docFilter = (tab: CatalogTab) => (e: AuditEntry) => {
  if (e.table_name !== "documents") return true;
  const d = (e.new_data ?? e.old_data) as { entity_table?: string } | null;
  return d?.entity_table === DOC_ENTITY[tab];
};

const LEGACY_TABS: Record<string, CatalogTab> = { zdroje: "technika" };

function recordLabel(e: AuditEntry, resolve: RefResolver): string {
  const data = (e.new_data ?? e.old_data) as Record<string, unknown> | null;
  if (e.table_name === "documents" && data) {
    const owner = resolve("entity_id", data.entity_id, data);
    return `Príloha: ${String(data.file_name ?? "")}${owner ? ` (${owner})` : ""}`;
  }
  if (e.table_name === "package_components" && data) {
    const pkg = resolve("package_item_id", data.package_item_id, data) ?? "?";
    const part = resolve("component_item_id", data.component_item_id, data) ?? "?";
    return `Kusovník: ${pkg} ← ${part}`;
  }
  const name =
    typeof data?.name === "string" ? data.name : typeof data?.code === "string" ? data.code : null;
  const table = CATALOG_TABLE_LABELS[e.table_name] ?? e.table_name;
  return name ? `${table}: ${name}` : table;
}

function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // old links (?tab=zdroje) lead to the renamed tab "Technika a vybavenie" (D24)
  const raw = LEGACY_TABS[params.get("tab") ?? ""] ?? params.get("tab");
  const tab: CatalogTab = CATALOG_TABS.some((t) => t.value === raw)
    ? (raw as CatalogTab)
    : "polozky";
  const openNew = params.get("nova") === "1";

  return (
    <div className="flex flex-col gap-4">
      <ChipGroup
        label="Časť katalógu"
        options={CATALOG_TABS}
        value={tab}
        onChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      />
      <BentoGrid className="md:auto-rows-[minmax(160px,auto)]">
        {tab === "polozky" && <ItemsTab key={params.get("nova") ?? ""} openNew={openNew} />}
        {tab === "balicky" && <PackagesTab key={params.get("nova") ?? ""} openNew={openNew} />}
        {tab === "jednotky" && <UnitsTab />}
        {tab === "sadzby" && <RatesTab />}
        {tab === "technika" && <ResourcesTab key={params.get("nova") ?? ""} openNew={openNew} />}
      </BentoGrid>
      {/* change history is always the last section of the page (DESIGN_SYSTEM §1) */}
      <RecordHistoryTile
        key={tab}
        tables={TAB_TABLES[tab]}
        fieldLabels={CATALOG_FIELD_LABELS}
        recordLabel={recordLabel}
        filter={DOC_ENTITY[tab] ? docFilter(tab) : undefined}
      />
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
