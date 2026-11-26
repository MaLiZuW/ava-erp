import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { CapacitySection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/reporting/kapacity/") };

export default function Page() {
  return <CapacitySection />;
}
