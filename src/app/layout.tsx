import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppShell } from "@/ui/app-shell";

export const metadata: Metadata = {
  title: "Add Value Agency",
  description: "Interný systém Add Value Agency – od dopytu po archív.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/av-mark.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
