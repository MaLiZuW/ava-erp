import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Providers } from "@/core/providers";
import { AppGate } from "./app-gate";

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
        <Providers>
          <AppGate>{children}</AppGate>
        </Providers>
      </body>
    </html>
  );
}
