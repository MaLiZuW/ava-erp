"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RequireAal2 } from "@/core/auth/require-aal2";
import { isAuthRoute } from "@/core/auth/status";
import { AppShell } from "@/ui/app-shell";

/** Sign-in pages render alone; everything else only behind aal2, inside the application shell. */
export function AppGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isAuthRoute(pathname)) return <>{children}</>;
  return (
    <RequireAal2>
      <AppShell>{children}</AppShell>
    </RequireAal2>
  );
}
