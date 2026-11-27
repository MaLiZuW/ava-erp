"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { NewAction } from "@/core/navigation";
import { Button } from "./button";

/** "+ Nové" in the top bar: a short menu of records that can be created. */
export function NewMenu({ actions }: { actions: readonly NewAction[] }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (actions.length === 0) {
    return (
      <Button disabled title="Pripravujeme">
        + Nové
      </Button>
    );
  }
  return (
    <div ref={ref} className="relative">
      <Button aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)}>
        + Nové
      </Button>
      {open && (
        <ul
          id={menuId}
          aria-label="Vytvoriť nový záznam"
          className="absolute right-0 z-40 mt-2 flex min-w-48 flex-col rounded-xl border border-neutral-200 bg-white p-1"
        >
          {actions.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                onClick={() => setOpen(false)}
                className="hover:bg-canvas block rounded-lg px-3 py-2 text-[15px]"
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
