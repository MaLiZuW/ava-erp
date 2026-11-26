import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { idlePhase, IDLE_WARNING_MS, LAST_ACTIVITY_KEY, parseInactivityMinutes } from "./idle";
import { IdleWarning, useIdleTimer } from "./idle-logout";

describe("parseInactivityMinutes", () => {
  it("defaults to 30 and clamps to 5–240", () => {
    expect(parseInactivityMinutes(undefined)).toBe(30);
    expect(parseInactivityMinutes(null)).toBe(30);
    expect(parseInactivityMinutes("abc")).toBe(30);
    expect(parseInactivityMinutes(45)).toBe(45);
    expect(parseInactivityMinutes("15")).toBe(15);
    expect(parseInactivityMinutes(1)).toBe(5);
    expect(parseInactivityMinutes(10_000)).toBe(240);
  });
});

describe("idlePhase", () => {
  const T = 30 * 60_000;
  it("is active, then warns in the last minute, then expires", () => {
    expect(idlePhase(1_000, 0, T)).toBe("active");
    expect(idlePhase(T - IDLE_WARNING_MS - 1, 0, T)).toBe("active");
    expect(idlePhase(T - IDLE_WARNING_MS, 0, T)).toBe("warning");
    expect(idlePhase(T, 0, T)).toBe("expired");
  });
});

function Probe({ timeoutMs, onExpire }: { timeoutMs: number; onExpire: () => void }) {
  const { phase, stayActive } = useIdleTimer(timeoutMs, onExpire);
  return (
    <>
      <p data-testid="phase">{phase}</p>
      <button onClick={stayActive}>stay</button>
    </>
  );
}

describe("useIdleTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T08:00:00Z"));
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  const TIMEOUT = 5 * 60_000;

  it("signs out exactly once after the timeout without activity", () => {
    const onExpire = vi.fn();
    render(<Probe timeoutMs={TIMEOUT} onExpire={onExpire} />);
    act(() => vi.advanceTimersByTime(TIMEOUT - IDLE_WARNING_MS + 1_000));
    expect(screen.getByTestId("phase")).toHaveTextContent("warning");
    expect(onExpire).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(IDLE_WARNING_MS + 5_000));
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("user activity postpones the sign-out", () => {
    const onExpire = vi.fn();
    render(<Probe timeoutMs={TIMEOUT} onExpire={onExpire} />);
    act(() => vi.advanceTimersByTime(TIMEOUT - 10_000));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown"));
    });
    act(() => vi.advanceTimersByTime(30_000));
    expect(onExpire).not.toHaveBeenCalled();
    expect(screen.getByTestId("phase")).toHaveTextContent("active");
  });

  it("activity in another tab (shared timestamp) keeps this tab signed in", () => {
    const onExpire = vi.fn();
    render(<Probe timeoutMs={TIMEOUT} onExpire={onExpire} />);
    act(() => vi.advanceTimersByTime(TIMEOUT - 10_000));
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    act(() => vi.advanceTimersByTime(30_000));
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("'stay signed in' resets the warning", () => {
    const onExpire = vi.fn();
    render(<Probe timeoutMs={TIMEOUT} onExpire={onExpire} />);
    act(() => vi.advanceTimersByTime(TIMEOUT - 30_000));
    expect(screen.getByTestId("phase")).toHaveTextContent("warning");
    act(() => screen.getByText("stay").click());
    expect(screen.getByTestId("phase")).toHaveTextContent("active");
  });
});

describe("IdleWarning", () => {
  it("is an accessible alert dialog with the remaining seconds", () => {
    render(<IdleWarning remainingMs={42_000} onStay={() => {}} />);
    expect(screen.getByRole("alertdialog", { name: "Odhlásenie pre nečinnosť" })).toHaveTextContent(
      "42 s",
    );
    expect(screen.getByRole("button", { name: "Zostať prihlásený" })).toHaveFocus();
  });
});
