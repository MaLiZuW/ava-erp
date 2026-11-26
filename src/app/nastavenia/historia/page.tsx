import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { HistorySection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/historia/") };

export default function Page() {
  return <HistorySection />;
}
