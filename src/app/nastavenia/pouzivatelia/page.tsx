import type { Metadata } from "next";
import { settingsTitle } from "@/core/navigation";
import { UsersSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: settingsTitle("/nastavenia/pouzivatelia/") };

export default function Page() {
  return <UsersSection />;
}
