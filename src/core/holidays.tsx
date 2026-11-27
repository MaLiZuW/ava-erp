"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { HolidaysContext } from "@/ui/date-input";
import { useAuth } from "./auth/auth-provider";
import { getSupabase } from "./supabase/client";

/**
 * Days of rest from public_holidays (block H) for every calendar in the app (DateInput).
 * Loaded once after sign-in with the second factor; RLS decides what is visible.
 */
export function HolidaysProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const holidays = useQuery({
    queryKey: ["public_holidays", "days_off"],
    enabled: status === "ready",
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("public_holidays")
        .select("date, name")
        .eq("is_day_off", true);
      if (error) return [];
      return data ?? [];
    },
  });
  const map = useMemo(
    () => new Map((holidays.data ?? []).map((h) => [h.date, h.name] as const)),
    [holidays.data],
  );
  return <HolidaysContext value={map}>{children}</HolidaysContext>;
}
