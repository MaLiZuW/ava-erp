import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { TaxSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/reporting/dane/") };

export default function Page() {
  return <TaxSection />;
}
