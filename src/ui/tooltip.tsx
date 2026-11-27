"use client";

import {
  useEffect,
  useId,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Small tooltip shown on hover AND keyboard focus. Rendered in a portal with fixed position,
 * so a scrolling container (the left menu) never clips it. `enabled = false` renders nothing
 * (e.g. the expanded menu, where the label is visible anyway). The link keeps its own
 * accessible name, so the bubble is visual only (no aria-describedby – no double reading).
 */
export function Tooltip({
  label,
  enabled = true,
  children,
}: {
  label: string;
  enabled?: boolean;
  /** a single element that accepts the mouse / focus handlers */
  children: (props: {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onFocus: (e: FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
  }) => ReactElement;
}) {
  const id = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = (el: HTMLElement) => {
    if (!enabled) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.right + 8 });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, [pos]);

  const bubble: ReactNode =
    pos && enabled ? (
      <span
        id={id}
        role="tooltip"
        style={{ top: pos.top, left: pos.left }}
        className="bg-ink pointer-events-none fixed z-50 -translate-y-1/2 rounded-lg px-2 py-1 text-[13px] font-medium whitespace-nowrap text-white"
      >
        {label}
      </span>
    ) : null;

  return (
    <>
      {children({
        onMouseEnter: (e) => show(e.currentTarget),
        onMouseLeave: hide,
        onFocus: (e) => show(e.currentTarget),
        onBlur: hide,
      })}
      {bubble && typeof document !== "undefined" ? createPortal(bubble, document.body) : null}
    </>
  );
}

/** True when the viewport is at least `px` wide (follows resizing). */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [match, setMatch] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(query).matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}
