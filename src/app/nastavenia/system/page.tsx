import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { SystemSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/system/") };

export default function Page() {
  return <SystemSection />;
}
