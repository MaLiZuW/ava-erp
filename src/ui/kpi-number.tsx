import { cn } from "./cn";

export function KpiNumber({
  value,
  label,
  hint,
  className,
}: {
  value: string;
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col justify-end", className)}>
      <p className="text-navy text-[48px] leading-[52px] font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {label && <p className="text-[13px] leading-5 font-medium text-neutral-700">{label}</p>}
      {hint && <p className="text-[13px] leading-5 text-neutral-500">{hint}</p>}
    </div>
  );
}
