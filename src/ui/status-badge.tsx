import { cn } from "./cn";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<StatusTone, string> = {
  neutral: "border-neutral-200 text-neutral-700",
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  danger: "border-danger/30 text-danger",
  info: "border-navy/30 text-navy",
};

/** State is always conveyed by text (WCAG), colour only reinforces it. */
export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-white px-3 py-0.5 text-[13px] leading-5 font-medium",
        TONES[tone],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
