/**
 * Pure auth logic (no React, no network) – unit tested in auth.test.tsx.
 *
 * Status machine of a browser session:
 *   loading → signed-out | needs-password | needs-enroll | needs-verify | ready
 * "needs-password": the session came from an invitation / recovery link – a password must be set first.
 * Data is visible only in "ready" (aal2). The database enforces the same rule (RLS require_aal2).
 */
import type { Database } from "@/core/supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type AuthStatus =
  | "loading"
  | "config-error"
  | "signed-out"
  | "needs-password"
  | "needs-enroll"
  | "needs-verify"
  | "ready";

export type AalLevel = string | null | undefined;

export const AUTH_ROUTES = {
  signIn: "/prihlasenie/",
  verify: "/prihlasenie/overenie/",
  enroll: "/prihlasenie/registracia-faktora/",
  newPassword: "/prihlasenie/nove-heslo/",
} as const;

export function isAuthRoute(pathname: string): boolean {
  return pathname === "/prihlasenie" || pathname.startsWith("/prihlasenie/");
}

/**
 * @param hasSession a session exists
 * @param currentLevel aal of the current session
 * @param nextLevel aal the user can reach (aal2 = has a verified TOTP factor)
 * @param mustSetPassword the session was opened by an invitation / recovery link
 */
export function resolveAuthStatus(
  hasSession: boolean,
  currentLevel: AalLevel,
  nextLevel: AalLevel,
  mustSetPassword = false,
): AuthStatus {
  if (!hasSession) return "signed-out";
  if (mustSetPassword) return "needs-password";
  if (currentLevel === "aal2") return "ready";
  if (nextLevel === "aal2") return "needs-verify";
  return "needs-enroll";
}

/** Where a guard must send the user for a given status (null = stay). */
export function routeForStatus(status: AuthStatus): string | null {
  switch (status) {
    case "signed-out":
      return AUTH_ROUTES.signIn;
    case "needs-verify":
      return AUTH_ROUTES.verify;
    case "needs-enroll":
      return AUTH_ROUTES.enroll;
    case "needs-password":
      return AUTH_ROUTES.newPassword;
    default:
      return null;
  }
}

/** Only same-origin absolute paths are accepted as a return target (no open redirect). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (isAuthRoute(next.split("?")[0])) return fallback;
  return next;
}

export function withNext(route: string, next: string): string {
  return next && next !== "/" ? `${route}?next=${encodeURIComponent(next)}` : route;
}

/** Admin can do everything; other roles must match exactly. */
export function hasRole(roles: readonly AppRole[], role: AppRole): boolean {
  return roles.includes("admin") || roles.includes(role);
}

/** Supabase Auth error → Slovak message for the user. */
export function authErrorMessage(
  error: { code?: string; message?: string; status?: number } | null,
): string {
  if (!error) return "";
  const code = error.code ?? "";
  if (code === "invalid_credentials") return "Nesprávny e-mail alebo heslo.";
  if (code === "mfa_verification_failed" || code === "mfa_challenge_expired")
    return "Neplatný kód. Zadajte aktuálny kód z aplikácie.";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429
  )
    return "Príliš veľa pokusov. Skúste to znova o niekoľko minút.";
  if (code === "weak_password") return "Heslo je príliš slabé.";
  if (code === "same_password") return "Nové heslo musí byť iné ako doterajšie.";
  if (code === "user_banned") return "Účet je zablokovaný. Kontaktujte administrátora.";
  if (code === "insufficient_aal") return "Najprv overte druhý faktor.";
  return "Akciu sa nepodarilo dokončiť. Skúste to znova.";
}

/** sessionStorage flag set when the app is opened from an invitation or recovery link */
export const MUST_SET_PASSWORD_KEY = "ava:must-set-password";

/** Reads the link type from the URL fragment that Supabase appends (#…&type=invite). */
export function linkTypeFromHash(hash: string): "invite" | "recovery" | null {
  const type = new URLSearchParams(hash.replace(/^#/, "")).get("type");
  return type === "invite" || type === "recovery" ? type : null;
}
