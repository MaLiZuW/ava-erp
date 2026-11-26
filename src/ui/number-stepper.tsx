"use client";

import { Minus, Plus } from "lucide-react";
import {
  useEffect,
  useRef,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
} from "react";
import { cn } from "./cn";
import { Input } from "./field";

/**
 * Default step by unit of measure (owner's rule, phase 3):
 * ks / bal → 1, hod → 0,5, kg / m / m2 → 0,1, anything else → 1.
 */
export function stepForUnit(unit: string | null | undefined): number {
  switch (unit) {
    case "hod":
      return 0.5;
    case "kg":
    case "m":
    case "m2":
      return 0.1;
    default:
      return 1;
  }
}

export interface StepOptions {
  step: number;
  min?: number;
  max?: number;
  /** max itself is not allowed (e.g. margin < 100 %) */
  maxExclusive?: boolean;
  /** rounding after each step – removes float noise such as 0,30000000004 */
  decimals?: number;
}

/** "1 234,5" / "1.5" → number; null when it is not a plain decimal number. */
export function parseStepperText(text: string): number | null {
  const s = text.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** 1.5 → "1,5" (comma, no trailing zeros). */
export function formatStepperNumber(n: number, decimals = 4): string {
  const f = 10 ** decimals;
  return String(Math.round(n * f) / f).replace(".", ",");
}

function round(n: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Whether one step in `direction` is possible from `text`. */
export function canStep(text: string, direction: 1 | -1, o: StepOptions): boolean {
  const min = o.min ?? 0;
  const cur = parseStepperText(text) ?? min;
  if (direction < 0) return cur > min;
  if (o.max == null) return true;
  return o.maxExclusive ? round(cur + o.step, o.decimals ?? 4) < o.max : cur < o.max;
}

/**
 * The text after one step: invalid / empty text counts as the minimum; the result is kept
 * within min / max (inclusive max is reached exactly, an exclusive one is never reached).
 */
export function stepValue(text: string, direction: 1 | -1, o: StepOptions, multiplier = 1): string {
  const decimals = o.decimals ?? 4;
  const min = o.min ?? 0;
  const cur = parseStepperText(text) ?? min;
  let next = round(cur + direction * o.step * multiplier, decimals);
  if (next < min) next = min;
  if (o.max != null) {
    if (o.maxExclusive) {
      if (next >= o.max) {
        // a smaller step may still fit (Shift ×10 near the limit)
        const single = round(cur + direction * o.step, decimals);
        next = single < o.max ? single : cur;
      }
    } else if (next > o.max) {
      next = o.max;
    }
  }
  return formatStepperNumber(next, decimals);
}

export type NumberStepperProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max" | "step"
> & {
  value: string;
  onChange: (value: string) => void;
  /**
   * Inline cells that save by themselves: called once after a pause (`commitDelay`, 800 ms)
   * or right away when focus leaves the stepper or Enter is pressed – and only when the value
   * really changed. Three clicks 2 → 5 = one save (one entry in the change history).
   */
  onCommit?: (value: string) => void;
  commitDelay?: number;
  /** name of the value for screen readers: "Znížiť – {label}" */
  label: string;
  step?: number;
  /** unit of measure → default step (stepForUnit) */
  unit?: string | null;
  min?: number;
  max?: number;
  maxExclusive?: boolean;
  decimals?: number;
  suffix?: string;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/**
 * Number field with − / + buttons (touch-friendly 40 px), ↑ / ↓ keys (Shift = step × 10),
 * decimal comma and free typing. The value stays text so zod schemas parse it as before.
 */
export function NumberStepper({
  value,
  onChange,
  onCommit,
  commitDelay = 800,
  label,
  step,
  unit,
  min = 0,
  max,
  maxExclusive,
  decimals = 4,
  suffix,
  invalid,
  className,
  disabled,
  onKeyDown,
  id,
  ref,
  ...input
}: NumberStepperProps) {
  const opts: StepOptions = { step: step ?? stepForUnit(unit), min, max, maxExclusive, decimals };
  // --- delayed commit (inline cells) -----------------------------------------------------
  const committed = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  // the newest callback without re-creating timers (also used by the unmount cleanup)
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });
  const commitNow = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const cb = onCommitRef.current;
    if (!cb || latest.current === committed.current) return;
    committed.current = latest.current;
    cb(latest.current);
  };
  const change = (next: string) => {
    onChange(next);
    if (!onCommit) return;
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commitNow, commitDelay);
  };
  // a pending change is not lost when the cell disappears (e.g. the list reloads)
  useEffect(() => () => commitNow(), []);

  const apply = (direction: 1 | -1, multiplier = 1) => {
    const next = stepValue(value, direction, opts, multiplier);
    if (next === value) return;
    change(next);
  };
  const leaveGroup = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitNow();
  };
  const keyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter") commitNow();
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      apply(e.key === "ArrowUp" ? 1 : -1, e.shiftKey ? 10 : 1);
    }
  };
  const button =
    "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-ink " +
    "transition-colors duration-150 ease-out hover:bg-canvas disabled:pointer-events-none disabled:opacity-40";

  return (
    // the input is named by its <label> (in a Field) or by aria-label; buttons by "Znížiť/Zvýšiť – …"
    <div role="group" className={cn("flex items-center gap-1", className)} onBlur={leaveGroup}>
      <button
        type="button"
        className={button}
        aria-label={`Znížiť – ${label}`}
        disabled={disabled || !canStep(value, -1, opts)}
        onClick={() => apply(-1)}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <div className="relative min-w-0 flex-1">
        <Input
          ref={ref}
          id={id}
          aria-label={id ? undefined : label}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          invalid={invalid}
          disabled={disabled}
          onChange={(e) => change(e.target.value)}
          onKeyDown={keyDown}
          className={cn("text-right tabular-nums", suffix && "pr-10")}
          {...input}
        />
        {suffix && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[15px] text-neutral-500"
          >
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        className={button}
        aria-label={`Zvýšiť – ${label}`}
        disabled={disabled || !canStep(value, 1, opts)}
        onClick={() => apply(1)}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}
