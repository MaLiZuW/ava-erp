import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { RecipientsSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/system/notifikacie/") };

export default function Page() {
  return <RecipientsSection />;
}
