import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { LogoSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/firma/logo/") };

export default function Page() {
  return <LogoSection />;
}
