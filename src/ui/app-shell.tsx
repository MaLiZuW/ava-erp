"use client";

import {
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  Files,
  Inbox,
  LayoutDashboard,
  Mail,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/core/auth/auth-provider";
import {
  findNavItem,
  SETTINGS_GROUPS,
  SETTINGS_HOME,
  SETTINGS_PAGES,
  visibleNavItems,
  visibleNewActions,
  type NavItem,
} from "@/core/navigation";
import { Button } from "./button";
import { cn } from "./cn";
import { CommandPalette } from "./command-palette";
import { NewMenu } from "./new-menu";
import { Tooltip, useMinWidth } from "./tooltip";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/dopyty/": Inbox,
  "/ponuky/": FileText,
  "/zakazky/": Briefcase,
  "/nakup/": ShoppingCart,
  "/dodanie/": Truck,
  "/faktury/": Receipt,
  "/emaily/": Mail,
  "/reporty/": BarChart3,
  "/dokumenty/": Files,
  "/zakaznici/": Users,
  "/dodavatelia/": Building2,
  "/katalog/": Package,
  "/nastavenia/": Settings,
};

/**
 * Menu item. Collapsed menu (< 1280 px): a 44 px square with the icon and a tooltip on hover
 * and keyboard focus. Expanded: icon + label. The focus ring is drawn inside the item so the
 * scrolling list (overflow hidden on the x axis) never cuts it.
 */
function NavLink({
  item,
  active,
  expanded,
  tooltip = true,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  /** false when a fly-out menu replaces the tooltip (Nastavenia) */
  tooltip?: boolean;
}) {
  const Icon = ICONS[item.href];
  return (
    <Tooltip label={item.label} enabled={!expanded && tooltip}>
      {(tip) => (
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          {...tip}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center gap-3 rounded-xl text-[15px] font-medium transition-colors duration-150 ease-out focus-visible:outline-offset-[-3px]",
            "xl:w-auto xl:justify-start xl:px-3",
            active ? "bg-navy text-white" : "text-ink hover:bg-canvas",
          )}
        >
          {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
          <span className="sr-only xl:not-sr-only">{item.label}</span>
        </Link>
      )}
    </Tooltip>
  );
}

/** Groups of the settings shown under "Nastavenia" in the main menu (first page of each group). */
const SETTINGS_SHORTCUTS = SETTINGS_GROUPS.map((g) => ({
  key: g.key,
  label: g.label,
  href: g.pages[0].href,
  hrefs: g.pages.map((p) => p.href),
}));

/**
 * "Nastavenia" in the main menu (owner's point 20): expanded menu → its groups listed below
 * while a settings page is open; collapsed menu → a fly-out with the groups on hover and on
 * keyboard focus (position: fixed, so the menu never clips it; DOM order keeps Tab working).
 */
function SettingsNavItem({
  item,
  active,
  expanded,
  pathname,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  pathname: string;
}) {
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = pathname.replace(/\/?$/, "/");
  const show = () => {
    if (expanded || !wrap.current) return;
    if (timer.current) clearTimeout(timer.current);
    const r = wrap.current.getBoundingClientRect();
    setPos({ left: r.right + 8, bottom: window.innerHeight - r.bottom });
  };
  const hideSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos(null), 150);
  };
  const groupLink = (g: (typeof SETTINGS_SHORTCUTS)[number]) => {
    const on = g.hrefs.includes(current);
    return (
      <Link
        key={g.key}
        href={g.href}
        aria-current={on ? "page" : undefined}
        onClick={() => setPos(null)}
        className={cn(
          "block rounded-lg px-3 text-[13px] leading-8 whitespace-nowrap focus-visible:outline-offset-[-3px]",
          on ? "text-navy bg-canvas font-semibold" : "text-ink hover:bg-canvas",
        )}
      >
        {g.label}
      </Link>
    );
  };
  return (
    <div
      ref={wrap}
      className="flex flex-col gap-1"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPos(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPos(null);
      }}
    >
      <NavLink item={item} active={active} expanded={expanded} tooltip={false} />
      {expanded && active && (
        <nav
          aria-label="Podmenu Nastavenia"
          data-testid="settings-subnav"
          className="scrollbar-quiet flex max-h-[40vh] flex-col overflow-y-auto pl-8"
        >
          {SETTINGS_SHORTCUTS.map(groupLink)}
        </nav>
      )}
      {!expanded && pos && (
        <nav
          aria-label="Podmenu Nastavenia"
          data-testid="settings-flyout"
          style={{ left: pos.left, bottom: pos.bottom }}
          className="fixed z-50 flex min-w-56 flex-col rounded-xl border border-neutral-200 bg-white p-1"
        >
          <p className="px-3 pt-1 pb-1 text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
            Nastavenia
          </p>
          {SETTINGS_SHORTCUTS.map(groupLink)}
        </nav>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { roles, fullName, email, signOut } = useAuth();
  const items = visibleNavItems(roles);
  const newActions = visibleNewActions(roles);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const current = findNavItem(pathname);
  const isActive = (item: NavItem) => current?.href === item.href;
  const expanded = useMinWidth(1280); // Tailwind xl – the menu shows labels

  return (
    <div className="flex min-h-screen">
      {/* Logo and the bottom block are pinned; only the module list scrolls on short screens. */}
      <aside
        data-testid="sidebar"
        className="no-print sticky top-0 z-30 flex h-dvh w-[72px] shrink-0 flex-col border-r border-neutral-200 bg-white xl:w-[240px]"
      >
        <Link
          href="/"
          aria-label="Add Value Agency – Prehľad"
          data-testid="sidebar-logo"
          className="mx-auto mt-3 mb-1 flex h-12 shrink-0 items-center gap-3 rounded-xl focus-visible:outline-offset-[-3px] xl:mx-3 xl:px-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/av-mark.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0"
          />
          <span className="text-navy hidden text-[13px] leading-4 font-semibold xl:block">
            Add Value Agency
          </span>
        </Link>
        <nav
          aria-label="Hlavná navigácia"
          data-testid="sidebar-scroll"
          className="scrollbar-quiet flex min-h-0 flex-1 flex-col items-center gap-1 overflow-x-hidden overflow-y-auto overscroll-contain py-3 pr-1 pl-3 xl:items-stretch"
        >
          {items
            .filter((i) => i.group === "main")
            .map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item)} expanded={expanded} />
            ))}
          <hr className="my-2 shrink-0 border-neutral-200" />
          {items
            .filter((i) => i.group === "master")
            .map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item)} expanded={expanded} />
            ))}
        </nav>
        <nav
          aria-label="Nastavenia a profil"
          data-testid="sidebar-bottom"
          // same gutter as the list above → the items line up
          className="scrollbar-quiet flex shrink-0 flex-col items-center gap-1 overflow-hidden border-t border-neutral-200 py-3 pr-1 pl-3 xl:items-stretch"
        >
          {items
            .filter((i) => i.group === "bottom")
            .map((item) =>
              item.href === SETTINGS_HOME ? (
                <SettingsNavItem
                  key={item.href}
                  item={item}
                  active={isActive(item)}
                  expanded={expanded}
                  pathname={pathname}
                />
              ) : (
                <NavLink key={item.href} item={item} active={isActive(item)} expanded={expanded} />
              ),
            )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex flex-wrap items-center justify-between gap-4 px-4 py-6 md:px-6 xl:px-8">
          <h1 className="text-navy text-[32px] leading-10 font-semibold">
            {current?.label ?? "Add Value Agency"}
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setPaletteOpen(true)}>
              Hľadať
              <kbd className="rounded-md border border-neutral-200 px-1.5 text-[13px] text-neutral-500">
                Ctrl+K
              </kbd>
            </Button>
            <NewMenu actions={newActions} />
            <span
              className="hidden text-[13px] leading-5 text-neutral-700 lg:inline"
              data-testid="current-user"
            >
              {fullName || email}
            </span>
            <Button variant="ghost" onClick={() => void signOut()}>
              Odhlásiť
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-8 md:px-6 xl:px-8">
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={items}
        newActions={newActions}
        settingsPages={items.some((i) => i.href === SETTINGS_HOME) ? SETTINGS_PAGES : []}
      />
    </div>
  );
}
