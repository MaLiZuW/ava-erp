"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth-provider";
import { routeForStatus, safeNext, withNext, type AuthStatus } from "./status";

function currentNext(): string {
  if (typeof window === "undefined") return "/";
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

/**
 * A sign-in page serves some statuses. When the status changes (e.g. after a successful
 * sign-in the provider refreshes), the user is moved to the right step or to the return path.
 */
export function useAuthStep(serves: readonly AuthStatus[]) {
  const auth = useAuth();
  const router = useRouter();
  const { status } = auth;
  const active = serves.includes(status);

  useEffect(() => {
    if (status === "loading" || status === "config-error" || serves.includes(status)) return;
    const next = currentNext();
    const route = routeForStatus(status);
    router.replace(route ? withNext(route, next) : next);
  }, [status, serves, router]);

  return { ...auth, active };
}
