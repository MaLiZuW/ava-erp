import type { ReactNode } from "react";
import { cn } from "./cn";

/** Bento tile sizes – docs/DESIGN_SYSTEM.md §2 (columns × rows on the 4-column desktop grid). */
export type TileSize = "S" | "M" | "L" | "XL" | "HERO";

const SIZE_CLASSES: Record<TileSize, string> = {
  S: "",
  M: "md:col-span-2",
  L: "md:col-span-2 md:row-span-2",
  XL: "md:col-span-2 md:row-span-2 xl:col-span-4",
  HERO: "md:col-span-2 xl:col-span-4",
};

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid auto-rows-[minmax(160px,auto)] grid-cols-1 gap-4 md:auto-rows-[160px] md:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TileProps {
  size: TileSize;
  title?: string;
  /** At most one action per tile (design principle 1). */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Tile({ size, title, action, children, className }: TileProps) {
  return (
    <section
      data-size={size}
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-neutral-200 bg-white p-6",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-4">
          {title && (
            <h2 className="text-[13px] leading-4 font-semibold tracking-[0.04em] text-neutral-500 uppercase">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
