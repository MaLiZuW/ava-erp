import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { SettingsOverview } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/") };

export default function Page() {
  return <SettingsOverview />;
}
