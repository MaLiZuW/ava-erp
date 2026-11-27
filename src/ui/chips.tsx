import { cn } from "./cn";

/** Filter "chips" above lists (DESIGN_SYSTEM.md §6.3). One option is always selected. */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150 ease-out",
            o.value === value
              ? "bg-navy border-navy text-white"
              : "hover:bg-canvas text-ink border-neutral-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
