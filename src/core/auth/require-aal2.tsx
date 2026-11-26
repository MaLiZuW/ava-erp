"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { routeForStatus, withNext } from "./status";

/** Full-screen skeleton while the session is being checked (design: skeletons, not spinners). */
export function AuthSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-canvas flex min-h-screen items-center justify-center p-8"
    >
      <span className="sr-only">Overujem prihlásenie…</span>
      <div
        aria-hidden
        className="w-full max-w-[480px] animate-pulse rounded-[20px] border border-neutral-200 bg-white p-6"
      >
        <div className="mb-4 h-4 w-24 rounded bg-neutral-200" />
        <div className="bg-canvas mb-2 h-10 w-full rounded-xl" />
        <div className="bg-canvas h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ConfigError() {
  return (
    <div role="alert" className="bg-canvas flex min-h-screen items-center justify-center p-8">
      <div className="max-w-[480px] rounded-[20px] border border-neutral-200 bg-white p-6">
        <p className="text-navy text-[20px] leading-7 font-semibold">
          Aplikácia nie je nakonfigurovaná
        </p>
        <p className="mt-2 text-neutral-700">
          Chýba adresa alebo verejný kľúč Supabase. Zostavte aplikáciu s vyplneným súborom
          .env.local.
        </p>
      </div>
    </div>
  );
}

/**
 * Renders children ONLY for a session with a second factor (aal2).
 * Every other state redirects to the matching sign-in step and renders a skeleton meanwhile.
 * This is a convenience for the UI – the database refuses data without aal2 anyway (RLS).
 */
export function RequireAal2({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const target = routeForStatus(status);

  useEffect(() => {
    if (target) {
      const next = typeof window === "undefined" ? pathname : pathname + window.location.search;
      router.replace(withNext(target, next));
    }
  }, [target, pathname, router]);

  if (status === "config-error") return <ConfigError />;
  if (status !== "ready") return <AuthSkeleton />;
  return <>{children}</>;
}
