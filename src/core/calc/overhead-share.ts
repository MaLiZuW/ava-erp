/**
 * Monthly share of a recurring overhead in cents – identical to private.overhead_month_share():
 * quarterly ÷ 3, yearly ÷ 12; the remaining cents go to the first months of each period
 * (counted from valid_from), so a whole period adds up exactly.
 */
export type Frequency = "monthly" | "quarterly" | "yearly";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: "mesačne",
  quarterly: "štvrťročne",
  yearly: "ročne",
};

export function overheadMonthShare(
  amountCents: number,
  frequency: Frequency,
  validFrom: string,
  month: string,
): number {
  const n = frequency === "quarterly" ? 3 : frequency === "yearly" ? 12 : 1;
  const [y0, m0] = validFrom.split("-").map(Number);
  const [y1, m1] = month.split("-").map(Number);
  const k = ((y1 - y0) * 12 + (m1 - m0)) % n;
  const base = Math.floor(amountCents / n);
  return base + (k < amountCents % n ? 1 : 0);
}
