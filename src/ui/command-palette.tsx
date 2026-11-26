"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { NAV_ITEMS, type NavItem } from "@/core/navigation";

/** Ctrl+K command palette. Phase 1: navigation only. */
export function CommandPalette({
  open,
  onOpenChange,
  items = NAV_ITEMS,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** navigation items the user may see */
  items?: readonly NavItem[];
}) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Vyhľadávanie a príkazy"
      overlayClassName="fixed inset-0 z-50 bg-ink/40"
      contentClassName="fixed top-[20%] left-1/2 z-50 w-[calc(100%-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-sm"
    >
      <Command.Input
        placeholder="Kam chcete ísť?"
        className="h-14 w-full border-b border-neutral-200 px-6 text-[15px] outline-none placeholder:text-neutral-500"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-4 py-6 text-[15px] text-neutral-700">
          Nič sa nenašlo.
        </Command.Empty>
        <Command.Group
          heading="Navigácia"
          className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[13px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.04em] [&_[cmdk-group-heading]]:text-neutral-500 [&_[cmdk-group-heading]]:uppercase"
        >
          {items.map((item) => (
            <Command.Item
              key={item.href}
              value={item.label}
              onSelect={() => {
                onOpenChange(false);
                router.push(item.href);
              }}
              className="data-[selected=true]:bg-canvas data-[selected=true]:text-navy cursor-pointer rounded-xl px-4 py-3 text-[15px]"
            >
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
