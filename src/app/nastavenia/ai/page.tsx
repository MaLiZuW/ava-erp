import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { AiSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/ai/") };

export default function Page() {
  return <AiSection />;
}
