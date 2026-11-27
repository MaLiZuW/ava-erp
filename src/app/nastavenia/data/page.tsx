import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { DataSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/data/") };

export default function Page() {
  return <DataSection />;
}
