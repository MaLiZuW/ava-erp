import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { OverheadSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/reporting/") };

export default function Page() {
  return <OverheadSection />;
}
