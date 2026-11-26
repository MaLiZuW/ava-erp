import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "./cn";
import { Input } from "./field";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/** Text input with a unit shown on the right (€, %, h …). The value stays plain text for zod. */
export function SuffixInput({ suffix, className, ...props }: InputProps & { suffix: string }) {
  return (
    <div className="relative">
      <Input {...props} className={cn("pr-10 text-right tabular-nums", className)} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[15px] text-neutral-500"
      >
        {suffix}
      </span>
    </div>
  );
}

/** Amount in euros, e.g. "1 234,56" (stored as cents – see moneyField). */
export function MoneyInput(props: InputProps) {
  return <SuffixInput suffix="€" inputMode="decimal" autoComplete="off" {...props} />;
}

/** Percentage, e.g. "12,5". */
export function PercentInput(props: InputProps) {
  return <SuffixInput suffix="%" inputMode="decimal" autoComplete="off" {...props} />;
}

/** Date DD/MM/YYYY (CLAUDE.md – dates in the UI). */
export function DateInput({ className, ...props }: InputProps) {
  return (
    <Input
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      autoComplete="off"
      maxLength={10}
      className={cn("tabular-nums", className)}
      {...props}
    />
  );
}
