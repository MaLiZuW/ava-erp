import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { KpiSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/reporting/ciele-kpi/") };

export default function Page() {
  return <KpiSection />;
}
