import type { InputHTMLAttributes, KeyboardEvent, Ref } from "react";
import { formatMoneyInput, parseMoneyToCents } from "@/core/format";
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

/**
 * Sets an input's value the way typing does, so React and react-hook-form (`register`)
 * receive a normal change event.
 */
export function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** ↑ / ↓ in a money field: ± 1,00 € (Shift ± 10,00 €), never below 0. */
export function stepMoneyText(text: string, direction: 1 | -1, shift: boolean): string {
  const cents = parseMoneyToCents(text) ?? 0;
  const next = Math.max(0, cents + direction * (shift ? 1000 : 100));
  return formatMoneyInput(next);
}

/** Amount in euros, e.g. "1 234,56" (stored as cents – see moneyField). No buttons, only ↑ / ↓. */
export function MoneyInput({ onKeyDown, ...props }: InputProps) {
  return (
    <SuffixInput
      suffix="€"
      inputMode="decimal"
      autoComplete="off"
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        const el = e.currentTarget;
        setNativeValue(el, stepMoneyText(el.value, e.key === "ArrowUp" ? 1 : -1, e.shiftKey));
      }}
      {...props}
    />
  );
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
