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
import { findNavItem, visibleNavItems, type NavItem } from "@/core/navigation";
import { Button } from "./button";
import { cn } from "./cn";
import { CommandPalette } from "./command-palette";

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

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.href];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors duration-150 ease-out",
        active ? "bg-navy text-white" : "text-ink hover:bg-canvas",
      )}
    >
      {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
      <span className="sr-only xl:not-sr-only">{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { roles, fullName, email, signOut } = useAuth();
  const items = visibleNavItems(roles);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const current = findNavItem(pathname);
  const isActive = (item: NavItem) => current?.href === item.href;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-[72px] shrink-0 flex-col border-r border-neutral-200 bg-white p-3 xl:w-[240px]">
        <Link
          href="/"
          aria-label="Add Value Agency – Prehľad"
          className="mb-4 flex h-12 items-center gap-3 px-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/av-mark.svg" alt="" width={40} height={40} />
          <span className="text-navy hidden text-[13px] leading-4 font-semibold xl:block">
            Add Value Agency
          </span>
        </Link>
        <nav aria-label="Hlavná navigácia" className="flex flex-1 flex-col gap-1">
          {items
            .filter((i) => i.group === "main")
            .map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item)} />
            ))}
          <hr className="my-2 border-neutral-200" />
          {items
            .filter((i) => i.group === "master")
            .map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item)} />
            ))}
          <div className="mt-auto flex flex-col gap-1">
            {items
              .filter((i) => i.group === "bottom")
              .map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item)} />
              ))}
          </div>
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
            <Button disabled title="Pripravujeme">
              + Nové
            </Button>
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

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={items} />
    </div>
  );
}
