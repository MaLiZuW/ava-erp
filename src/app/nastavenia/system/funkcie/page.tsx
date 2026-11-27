import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { FlagsSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/system/funkcie/") };

export default function Page() {
  return <FlagsSection />;
}
