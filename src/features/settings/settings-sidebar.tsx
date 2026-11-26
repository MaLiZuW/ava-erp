"use client";

import {
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Coins,
  History,
  Image as ImageIcon,
  Landmark,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SETTINGS_GROUPS, SETTINGS_HOME } from "@/core/navigation";
import { LAST_APP_PATH } from "@/ui/app-shell";
import { cn } from "@/ui/cn";
import { Tooltip, useMinWidth } from "@/ui/tooltip";
import { useSettingsStatus } from "./settings-status";

const PAGE_ICONS: Record<string, LucideIcon> = {
  "/nastavenia/firma/": Building2,
  "/nastavenia/firma/logo/": ImageIcon,
  "/nastavenia/pouzivatelia/": ShieldCheck,
  "/nastavenia/system/": Settings2,
  "/nastavenia/system/funkcie/": ToggleLeft,
  "/nastavenia/system/notifikacie/": Bell,
  "/nastavenia/ai/": Sparkles,
  "/nastavenia/reporting/rezia/": Coins,
  "/nastavenia/reporting/dane/": Landmark,
  "/nastavenia/reporting/kapacity/": CalendarDays,
  "/nastavenia/reporting/ciele-kpi/": Target,
  "/nastavenia/data/": ClipboardCheck,
  "/nastavenia/historia/": History,
};

/**
 * Settings mode (owner's point 21, pattern Linear / Vercel / GitHub): the left panel becomes the
 * settings menu – "← Späť do aplikácie", title, short groups with icons and state markers.
 * Active item: soft background + 2 px brand-blue line on the left + bold navy text.
 */
export function SettingsSidebar() {
  const pathname = usePathname().replace(/\/?$/, "/");
  const wide = useMinWidth(768); // md – labels visible (narrower: icons with tooltips)
  const status = useSettingsStatus();
  // the last page of the app (the shell is rendered in the browser only, after sign-in)
  const [back] = useState(() =>
    typeof window === "undefined" ? "/" : (sessionStorage.getItem(LAST_APP_PATH) ?? "/"),
  );

  const item = (
    href: string,
    label: string,
    Icon: LucideIcon,
    badge?: { text: string; tone: string; short: string },
  ) => {
    const active = pathname === href;
    return (
      <Tooltip key={href} label={badge ? `${label} – ${badge.text}` : label} enabled={!wide}>
        {(tip) => (
          <Link
            href={href}
            aria-current={active ? "page" : undefined}
            {...tip}
            title={badge && wide ? `${label} – ${badge.text}` : undefined}
            className={cn(
              "relative flex h-9 shrink-0 items-center gap-2.5 rounded-lg border-l-2 pr-2 pl-2.5 text-[14px] transition-colors duration-150 ease-out focus-visible:outline-offset-[-3px]",
              active
                ? "bg-canvas border-brand text-navy font-semibold"
                : "text-ink hover:bg-canvas border-transparent",
              !wide && "w-11 justify-center px-0",
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className={cn("min-w-0 flex-1 truncate", !wide && "sr-only")}>{label}</span>
            {badge && (
              <span
                data-testid="settings-badge"
                className={cn(
                  "flex items-center gap-1 text-[12px] font-medium whitespace-nowrap",
                  badge.tone === "warning" ? "text-warning" : "text-neutral-700",
                  !wide && "absolute top-1 right-1",
                )}
              >
                <span aria-hidden className="size-2 rounded-full bg-current" />
                {/* a dot (or a number) keeps the label whole; the text is in the title / for screen readers */}
                {badge.short && (
                  <span aria-hidden className={cn(!wide && "sr-only")}>
                    {badge.short}
                  </span>
                )}
                <span className="sr-only">{badge.text}</span>
              </span>
            )}
          </Link>
        )}
      </Tooltip>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="settings-sidebar">
      <div className="flex shrink-0 flex-col gap-1 border-b border-neutral-200 p-3">
        <Link
          href={back}
          className={cn(
            "text-ink hover:bg-canvas flex h-9 items-center gap-2 rounded-lg px-2 text-[14px] font-medium",
            !wide && "w-11 justify-center px-0",
          )}
          aria-label="Späť do aplikácie"
        >
          <ArrowLeft aria-hidden className="size-4 shrink-0" />
          <span className={cn(!wide && "sr-only")}>Späť do aplikácie</span>
        </Link>
        <Link
          href={SETTINGS_HOME}
          aria-current={pathname === SETTINGS_HOME ? "page" : undefined}
          className={cn("text-navy px-2 text-[18px] leading-7 font-semibold", !wide && "sr-only")}
        >
          Nastavenia
        </Link>
      </div>
      <nav
        aria-label="Menu nastavení"
        className="scrollbar-quiet flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain p-3"
      >
        {!wide && item(SETTINGS_HOME, "Prehľad nastavení", BarChart3)}
        {SETTINGS_GROUPS.map((g) => (
          <div key={g.key} className="flex flex-col gap-0.5">
            <p
              className={cn(
                "px-2.5 pb-0.5 text-[12px] leading-4 font-medium whitespace-nowrap text-neutral-500",
                !wide && "sr-only",
              )}
            >
              {g.label}
            </p>
            {g.pages.map((p) =>
              item(p.href, p.label, PAGE_ICONS[p.href] ?? Settings2, status[p.href]),
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}
