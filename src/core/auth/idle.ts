/** Inactivity sign-out – pure helpers (tested in idle.test.tsx). */

export const IDLE_DEFAULT_MINUTES = 30;
export const IDLE_MIN_MINUTES = 5;
export const IDLE_MAX_MINUTES = 240;
/** warning shown this long before the automatic sign-out */
export const IDLE_WARNING_MS = 60_000;
/** shared by all tabs: activity in one tab keeps the others signed in */
export const LAST_ACTIVITY_KEY = "ava:last-activity";
/** set right before an automatic sign-out, shown once on the sign-in page */
export const IDLE_SIGNED_OUT_KEY = "ava:idle-signed-out";

/** system_settings.inactivity_minutes (jsonb) → minutes; missing/invalid → 30, clamped to 5–240. */
export function parseInactivityMinutes(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return IDLE_DEFAULT_MINUTES;
  return Math.min(IDLE_MAX_MINUTES, Math.max(IDLE_MIN_MINUTES, Math.round(n)));
}

export type IdlePhase = "active" | "warning" | "expired";

export function idlePhase(
  now: number,
  lastActivity: number,
  timeoutMs: number,
  warnMs = IDLE_WARNING_MS,
): IdlePhase {
  const idle = now - lastActivity;
  if (idle >= timeoutMs) return "expired";
  if (idle >= timeoutMs - Math.min(warnMs, timeoutMs)) return "warning";
  return "active";
}
