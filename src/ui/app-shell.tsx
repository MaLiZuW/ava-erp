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
import { useState, type ReactNode } from "react";
import { useAuth } from "@/core/auth/auth-provider";
import { findNavItem, visibleNavItems, visibleNewActions, type NavItem } from "@/core/navigation";
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
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
}) {
  const Icon = ICONS[item.href];
  return (
    <Tooltip label={item.label} enabled={!expanded}>
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
        className="no-print sticky top-0 flex h-dvh w-[72px] shrink-0 flex-col border-r border-neutral-200 bg-white xl:w-[240px]"
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
            .map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item)} expanded={expanded} />
            ))}
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
      />
    </div>
  );
}
