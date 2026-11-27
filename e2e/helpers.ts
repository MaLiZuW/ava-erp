import { expect, type Page } from "@playwright/test";
import { totpCode, type TestUser } from "../scripts/lib/test-users";

/** First sign-in of a fresh user: password → TOTP enrolment → dashboard. Returns the TOTP secret. */
export async function signInAndEnroll(page: Page, user: TestUser): Promise<string> {
  await page.goto("/prihlasenie/");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Heslo").fill(user.password);
  await page.getByRole("button", { name: "Pokračovať" }).click();
  await expect(page).toHaveURL(/\/prihlasenie\/registracia-faktora\//, { timeout: 15_000 });
  await page.getByLabel("Názov zariadenia").fill("E2E telefón");
  await page.getByRole("button", { name: "Zobraziť QR kód" }).click();
  await expect(page.getByAltText(/QR kód/)).toBeVisible({ timeout: 15_000 });
  const secret = ((await page.getByTestId("totp-secret").textContent()) ?? "").replace(/\s+/g, "");
  await page.getByLabel(/Kód z aplikácie/).fill(totpCode(secret));
  await page.getByRole("button", { name: "Overiť a dokončiť" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prehľad", { timeout: 15_000 });
  return secret;
}
