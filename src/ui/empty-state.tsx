import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2">
      <p className="text-navy text-[20px] leading-7 font-semibold">{title}</p>
      {description && <p className="max-w-prose text-[15px] text-neutral-700">{description}</p>}
      {children}
    </div>
  );
}
