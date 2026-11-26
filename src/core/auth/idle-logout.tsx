"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/core/supabase/client";
import { Button } from "@/ui/button";
import { useAuth } from "./auth-provider";
import {
  IDLE_SIGNED_OUT_KEY,
  IDLE_WARNING_MS,
  idlePhase,
  LAST_ACTIVITY_KEY,
  parseInactivityMinutes,
  type IdlePhase,
} from "./idle";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
] as const;
const WRITE_THROTTLE_MS = 5_000;
const TICK_MS = 1_000;

function readShared(): number {
  const v = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(v) ? v : 0;
}

/**
 * Tracks activity (all tabs via localStorage) and calls `onExpire` once after `timeoutMs` of inactivity.
 */
export function useIdleTimer(timeoutMs: number, onExpire: () => void) {
  const last = useRef(0);
  const lastWrite = useRef(0);
  const expired = useRef(false);
  const [phase, setPhase] = useState<IdlePhase>("active");
  const [remainingMs, setRemainingMs] = useState(timeoutMs);

  const touch = useCallback((force = false) => {
    const now = Date.now();
    last.current = now;
    if (force || now - lastWrite.current >= WRITE_THROTTLE_MS) {
      lastWrite.current = now;
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }
  }, []);

  useEffect(() => {
    touch(true);
    expired.current = false;
    const check = () => {
      const now = Date.now();
      const lastActivity = Math.max(last.current, readShared());
      const p = idlePhase(now, lastActivity, timeoutMs);
      setPhase(p);
      setRemainingMs(Math.max(0, timeoutMs - (now - lastActivity)));
      if (p === "expired" && !expired.current) {
        expired.current = true;
        onExpire();
      }
    };
    const onActivity = () => touch();
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { passive: true });
    document.addEventListener("visibilitychange", check);
    const id = window.setInterval(check, TICK_MS);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(id);
    };
  }, [timeoutMs, onExpire, touch]);

  const stayActive = useCallback(() => {
    touch(true);
    setPhase("active");
    setRemainingMs(timeoutMs);
  }, [touch, timeoutMs]);

  return { phase, remainingMs, stayActive };
}

/** Reads the setting (admin-only by RLS; others get the default 30 min). */
function useInactivityMinutes(): number {
  const { data } = useQuery({
    queryKey: ["system_settings", "inactivity_minutes"],
    queryFn: async () => {
      const { data: row } = await getSupabase()
        .from("system_settings")
        .select("value")
        .eq("key", "inactivity_minutes")
        .maybeSingle();
      return parseInactivityMinutes(row?.value);
    },
    staleTime: 5 * 60_000,
  });
  return data ?? parseInactivityMinutes(undefined);
}

export function IdleWarning({ remainingMs, onStay }: { remainingMs: number; onStay: () => void }) {
  return (
    <div className="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-desc"
        className="w-full max-w-[480px] rounded-[20px] border border-neutral-200 bg-white p-6"
      >
        <h2 id="idle-title" className="text-navy text-[20px] leading-7 font-semibold">
          Odhlásenie pre nečinnosť
        </h2>
        <p id="idle-desc" className="mt-2 text-neutral-700">
          Z bezpečnostných dôvodov vás odhlásime o{" "}
          <strong className="tabular-nums">{Math.ceil(remainingMs / 1000)} s</strong>.
        </p>
        <Button className="mt-6" autoFocus onClick={onStay}>
          Zostať prihlásený
        </Button>
      </div>
    </div>
  );
}

/** Mounted inside the protected part of the application. */
export function IdleLogout() {
  const { signOut } = useAuth();
  const minutes = useInactivityMinutes();
  const onExpire = useCallback(() => {
    window.sessionStorage.setItem(IDLE_SIGNED_OUT_KEY, "1");
    void signOut();
  }, [signOut]);
  const { phase, remainingMs, stayActive } = useIdleTimer(minutes * 60_000, onExpire);
  if (phase !== "warning" || remainingMs > IDLE_WARNING_MS) return null;
  return <IdleWarning remainingMs={remainingMs} onStay={stayActive} />;
}
