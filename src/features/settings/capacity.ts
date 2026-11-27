/**
 * Capacity calendar helpers (block H, D24): month grid Monday-first, week of a day, sums.
 * Pure functions – dates are ISO strings "YYYY-MM-DD" (no time zone shifts).
 */

export const WEEKDAYS = [
  { key: "mon", short: "Po", label: "Pondelok" },
  { key: "tue", short: "Ut", label: "Utorok" },
  { key: "wed", short: "St", label: "Streda" },
  { key: "thu", short: "Št", label: "Štvrtok" },
  { key: "fri", short: "Pi", label: "Piatok" },
  { key: "sat", short: "So", label: "Sobota" },
  { key: "sun", short: "Ne", label: "Nedeľa" },
] as const;
export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

export const EXCEPTION_KINDS = {
  vacation: { label: "Dovolenka", hint: "Celý deň 0 h.", needsHours: false },
  unavailable: {
    label: "Nedostupnosť",
    hint: "Celý deň 0 h. Čiastočne → „Iná práca mimo systému“.",
    needsHours: false,
  },
  other_work: {
    label: "Iná práca mimo systému",
    hint: "Odpočíta zadané hodiny.",
    needsHours: true,
  },
  extra: {
    label: "Extra hodiny",
    hint: "Pridá zadané hodiny (aj vo sviatok či víkend).",
    needsHours: true,
  },
} as const;
export type ExceptionKind = keyof typeof EXCEPTION_KINDS;

const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (y: number, m1: number, d: number) => `${y}-${pad(m1)}-${pad(d)}`;

function toUtc(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUtc(d: Date): string {
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(day: string, n: number): string {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(day: string): number {
  return (toUtc(day).getUTCDay() + 6) % 7;
}

/** Monday of the week the day belongs to. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

export function monthStart(year: number, month1: number): string {
  return iso(year, month1, 1);
}

export function monthEnd(year: number, month1: number): string {
  return fromUtc(new Date(Date.UTC(year, month1, 0)));
}

/** Weeks of a month view (Monday-first); days outside the month are null. */
export function monthGrid(year: number, month1: number): (string | null)[][] {
  const first = monthStart(year, month1);
  const last = monthEnd(year, month1);
  const weeks: (string | null)[][] = [];
  let day = weekStart(first);
  while (day <= last) {
    const week: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day >= first && day <= last ? day : null);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Sum of hours of the days in [from, to]. */
export function sumHours(
  rows: readonly { day: string; available_hours: number | string }[],
  from: string,
  to: string,
): number {
  const total = rows
    .filter((r) => r.day >= from && r.day <= to)
    .reduce((s, r) => s + Number(r.available_hours), 0);
  return Math.round(total * 100) / 100;
}

/** Hours with a decimal comma: 7.5 → "7,5 h". */
export function hoursText(n: number): string {
  return `${String(Math.round(n * 100) / 100).replace(".", ",")} h`;
}

/** Ordered pair of a selection (click + Shift+click may go backwards). */
export function orderRange(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}
