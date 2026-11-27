/**
 * Purchase price in EUR without VAT from a price in a currency, with or without VAT (D26).
 * EUR = original ÷ (1 + VAT) ÷ rate, rounded half up to cents. The exchange rate is the amount of
 * the currency for 1 EUR (as published by ECB / NBS, e.g. 25,125 CZK). Computed with integers
 * only – the same result as private.cost_to_eur_cents in the database.
 */

/** "25,125" / "25.125" → 25125000 millionths; null when not a positive number with ≤ 6 decimals. */
export function parseRateMicro(input: string): bigint | null {
  const v = input.trim().replace(/\s/g, "").replace(",", ".");
  const m = /^(\d{1,6})(?:\.(\d{1,6}))?$/.exec(v);
  if (!m) return null;
  const micro = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
  return micro > 0n ? micro : null;
}

/** VAT rate in hundredths of a percent ("21" → 2100, "5,5" → 550). */
export function vatBasisPoints(pct: number): bigint {
  return BigInt(Math.round(pct * 100));
}

export function costToEurCents(
  originalCents: number,
  {
    vatPct = null,
    rateMicro = 1_000_000n,
  }: { vatPct?: number | null; rateMicro?: bigint | null } = {},
): number {
  const vat = vatPct == null ? 0n : vatBasisPoints(vatPct);
  const rate = rateMicro ?? 1_000_000n;
  const num = BigInt(originalCents) * 10_000n * 1_000_000n;
  const den = (10_000n + vat) * rate;
  return Number((2n * num + den) / (2n * den)); // half up
}
