/**
 * Cost rate of an own resource (BUSINESS_PROCESSES.md 5.3):
 *   purchase cost ÷ expected life hours + operating cost per hour
 * Integer cents, half up – identical to the generated column resources.cost_rate_cents
 * (Postgres round(numeric) = half away from zero; all values are >= 0).
 * Integer arithmetic only: hours are converted to hundredths (numeric(10,2) in the database).
 */
export function resourceCostRateCents(
  purchaseCostCents: number,
  expectedLifeHours: number,
  operatingCostPerHourCents: number,
): number | null {
  if (
    !Number.isSafeInteger(purchaseCostCents) ||
    !Number.isSafeInteger(operatingCostPerHourCents) ||
    purchaseCostCents < 0 ||
    operatingCostPerHourCents < 0 ||
    !Number.isFinite(expectedLifeHours)
  ) {
    return null;
  }
  const hundredths = BigInt(Math.round(expectedLifeHours * 100));
  if (hundredths <= 0n) return null;
  // purchase / (h/100) = purchase*100 / h; half up: floor((2·a + b) / (2·b))
  const a = BigInt(purchaseCostCents) * 100n;
  const depreciation = (2n * a + hundredths) / (2n * hundredths);
  return Number(depreciation + BigInt(operatingCostPerHourCents));
}
