import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** numbers: right-aligned, tabular digits */
  numeric?: boolean;
  /** hidden in the mobile card (the first column is always the card title) */
  hideOnMobile?: boolean;
  className?: string;
}

/**
 * List table – DESIGN_SYSTEM.md §6.3: no stripes, 48 px rows, sticky header; on mobile (< 768 px)
 * every row becomes a card. When `rowHref` is given the first cell links to the detail.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const [first, ...rest] = columns;
  const firstCell = (row: T) =>
    rowHref ? (
      <Link href={rowHref(row)} className="text-navy font-medium hover:underline">
        {first.cell(row)}
      </Link>
    ) : (
      first.cell(row)
    );

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-neutral-200">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "h-12 px-3 text-left text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase first:pl-0",
                    c.numeric && "text-right",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-canvas/60 h-12 border-b border-neutral-200">
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 first:pl-0",
                      c.numeric && "text-right tabular-nums",
                      c.className,
                    )}
                  >
                    {i === 0 ? firstCell(row) : c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border border-neutral-200 p-4">
            <p className="text-[15px]">{firstCell(row)}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              {rest
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-neutral-500">{c.header}</dt>
                    <dd className={cn(c.numeric && "tabular-nums")}>{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
