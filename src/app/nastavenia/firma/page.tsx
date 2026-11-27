import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { CompanySection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/firma/") };

export default function Page() {
  return <CompanySection />;
}
