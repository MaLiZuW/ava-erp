import { expect, test, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loadTestEnv,
  purgeTestUsers,
  totpCode,
  type TestEnv,
  type TestUser,
} from "../scripts/lib/test-users";

/**
 * Real sign-in against the DEV project: password → TOTP enrolment / prompt → dashboard.
 * Needs NEXT_PUBLIC_SUPABASE_*, SUPABASE_SECRET_KEY and SUPABASE_DB_URL in .env.local (the build
 * in out/ must be made with the same NEXT_PUBLIC_* values). Without them (CI) the suite is skipped.
 * The user and the TOTP secret are random per run and deleted afterwards.
 */
const env: TestEnv | null = loadTestEnv({ optional: true });

test.describe.serial("sign-in with TOTP", () => {
  test.skip(!env, "Supabase test credentials are not configured (.env.local) – skipped.");
  // a TOTP code is used once; waiting for the next 30 s window must fit into the test
  test.setTimeout(90_000);
  // the dev project (Free plan) can answer slowly; server round-trips get more time than the 5 s default
  test.use({ actionTimeout: 15_000 });

  let user: TestUser | null = null;
  let secret = "";
  let lastCode = "";

  test.beforeAll(async () => {
    await purgeTestUsers(env!);
    user = await createTestUser(env!, "e2e", { admin: true });
  });

  test.afterAll(async () => {
    await deleteTestUser(env!, user);
  });

  /** A TOTP code that differs from the previous one (waits for the next 30 s window if needed). */
  async function freshCode(page: Page): Promise<string> {
    let code = totpCode(secret);
    while (code === lastCode) {
      await page.waitForTimeout(1000);
      code = totpCode(secret);
    }
    lastCode = code;
    return code;
  }

  async function signInWithPassword(page: Page) {
    await page.goto("/prihlasenie/");
    await page.getByLabel("E-mail").fill(user!.email);
    await page.getByLabel("Heslo").fill(user!.password);
    await page.getByRole("button", { name: "Pokračovať" }).click();
  }

  test("first sign-in requires TOTP enrolment, then opens the dashboard", async ({ page }) => {
    await signInWithPassword(page);
    await expect(page).toHaveURL(/\/prihlasenie\/registracia-faktora\//, { timeout: 15_000 });
    await expect(page.getByRole("navigation", { name: "Hlavná navigácia" })).toHaveCount(0);

    await page.getByLabel("Názov zariadenia").fill("E2E telefón");
    await page.getByRole("button", { name: "Zobraziť QR kód" }).click();
    await expect(page.getByAltText(/QR kód/)).toBeVisible({ timeout: 15_000 });
    secret = ((await page.getByTestId("totp-secret").textContent()) ?? "").replace(/\s+/g, "");
    expect(secret.length).toBeGreaterThanOrEqual(16);

    await page.getByLabel(/Kód z aplikácie/).fill(await freshCode(page));
    await page.getByRole("button", { name: "Overiť a dokončiť" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prehľad", {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("navigation", { name: "Hlavná navigácia" }).getByRole("link"),
    ).toHaveCount(14);
  });

  test("next sign-in asks for the code; a wrong code is refused", async ({ page }) => {
    await signInWithPassword(page);
    await expect(page).toHaveURL(/\/prihlasenie\/overenie\//, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overenie", {
      timeout: 15_000,
    });

    const good = totpCode(secret);
    const wrong = String((Number(good) + 1) % 1_000_000).padStart(6, "0");
    await page.getByLabel(/Kód z aplikácie/).fill(wrong);
    await page.getByRole("button", { name: "Overiť", exact: true }).click();
    await expect(page.getByText(/^Neplatný kód/)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/prihlasenie\/overenie\//, { timeout: 15_000 });

    await page.getByLabel(/Kód z aplikácie/).fill(await freshCode(page));
    await page.getByRole("button", { name: "Overiť", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prehľad", {
      timeout: 15_000,
    });
  });

  test("the return path is kept through sign-in and sign-out ends the session", async ({
    page,
  }) => {
    await page.goto("/zakazky/");
    await expect(page).toHaveURL(/\/prihlasenie\/\?next=%2Fzakazky%2F/, { timeout: 15_000 });
    await page.getByLabel("E-mail").fill(user!.email);
    await page.getByLabel("Heslo").fill(user!.password);
    await page.getByRole("button", { name: "Pokračovať" }).click();
    await page.getByLabel(/Kód z aplikácie/).fill(await freshCode(page));
    await page.getByRole("button", { name: "Overiť", exact: true }).click();
    await expect(page).toHaveURL(/\/zakazky\/$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zákazky", {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Odhlásiť" }).click();
    await expect(page).toHaveURL(/\/prihlasenie\//, { timeout: 15_000 });
    await page.goto("/");
    await expect(page).toHaveURL(/\/prihlasenie\/$/, { timeout: 15_000 });
  });
});
