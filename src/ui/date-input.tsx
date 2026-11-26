"use client";

import { CalendarDays, Sun } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type Ref,
} from "react";
import { DayButton, DayPicker, type DayButtonProps } from "react-day-picker";
import { sk } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { formatDate, parseDate } from "@/core/format";
import { cn } from "./cn";
import { Input } from "./field";
import { setNativeValue } from "./native-value";

/** Days of rest / holidays shown in every calendar: ISO date → name. Filled by the core provider. */
export const HolidaysContext = createContext<ReadonlyMap<string, string>>(new Map());

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (isoDay: string) => {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** A day of the calendar: weekend and day of rest are told by text (aria-label) and an icon. */
function HolidayDayButton(p: DayButtonProps) {
  const holidays = useContext(HolidaysContext);
  const iso = isoOf(p.day.date);
  const name = holidays.get(iso);
  const weekend = p.day.date.getDay() === 0 || p.day.date.getDay() === 6;
  const extra = [name && `deň pracovného pokoja: ${name}`, !name && weekend && "víkend"]
    .filter(Boolean)
    .join(", ");
  return (
    <DayButton
      {...p}
      aria-label={`${formatDate(iso)}${extra ? ` – ${extra}` : ""}`}
      title={name ?? undefined}
    >
      {p.children}
      {name && <Sun aria-hidden className="text-warning absolute top-0.5 right-0.5 size-2.5" />}
    </DayButton>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
  /** earliest / latest allowed date, ISO "YYYY-MM-DD" */
  minDate?: string;
  maxDate?: string;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref && typeof ref === "object") (ref as { current: T | null }).current = value;
}

/**
 * Date field DD/MM/YYYY (owner's point 19): typing stays; the calendar icon opens a Slovak
 * calendar (Monday first, today highlighted, "Dnes", weekends and days of rest marked with
 * text and an icon, month and year switch, keyboard: arrows, Enter, Esc; optional min / max).
 * Works with react-hook-form `register()` and with controlled `value` / `onChange`
 * (a picked day is written like typing).
 */
export function DateInput({
  className,
  ref,
  minDate,
  maxDate,
  disabled,
  onKeyDown,
  ...props
}: InputProps) {
  const holidays = useContext(HolidaysContext);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openCalendar = () => {
    const current = parseDate(inputRef.current?.value ?? "");
    setSelected(current ? dateOf(current) : undefined);
    setOpen(true);
  };
  const choose = (d: Date | undefined) => {
    if (!d || !inputRef.current) return;
    setNativeValue(inputRef.current, formatDate(isoOf(d)));
    setOpen(false);
    inputRef.current.focus();
  };
  const today = new Date();
  const holidayDates = [...holidays.keys()].map(dateOf);
  const yearNow = today.getFullYear();

  return (
    <div ref={wrapRef} className="relative">
      <Input
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        autoComplete="off"
        maxLength={10}
        disabled={disabled}
        className={cn("pr-10 tabular-nums", className)}
        ref={(el) => {
          inputRef.current = el;
          assignRef(ref, el);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.altKey && e.key === "ArrowDown") {
            e.preventDefault();
            openCalendar();
          }
        }}
        {...props}
      />
      <button
        type="button"
        aria-label="Vybrať dátum z kalendára"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className="hover:bg-canvas absolute inset-y-0 right-1 my-1 flex w-8 items-center justify-center rounded-lg text-neutral-700 disabled:opacity-40"
      >
        <CalendarDays aria-hidden className="size-4" />
      </button>
      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label="Kalendár"
          className="absolute top-full left-0 z-50 mt-1 rounded-xl border border-neutral-200 bg-white p-3"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
              inputRef.current?.focus();
            }
          }}
        >
          <DayPicker
            mode="single"
            locale={sk}
            weekStartsOn={1}
            autoFocus
            selected={selected}
            onSelect={choose}
            defaultMonth={selected ?? today}
            captionLayout="dropdown"
            startMonth={new Date(yearNow - 10, 0)}
            endMonth={new Date(yearNow + 10, 11)}
            disabled={[
              ...(minDate ? [{ before: dateOf(minDate) }] : []),
              ...(maxDate ? [{ after: dateOf(maxDate) }] : []),
            ]}
            modifiers={{ holiday: holidayDates, weekend: { dayOfWeek: [0, 6] } }}
            modifiersClassNames={{ holiday: "rdp-holiday", weekend: "rdp-weekend" }}
            components={{ DayButton: HolidayDayButton }}
            footer={
              <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-neutral-700">
                <span className="flex items-center gap-1">
                  <Sun aria-hidden className="text-warning size-3" /> deň pracovného pokoja
                </span>
                <button
                  type="button"
                  className="text-navy rounded-lg px-2 py-1 font-medium hover:underline"
                  onClick={() => choose(today)}
                >
                  Dnes
                </button>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
