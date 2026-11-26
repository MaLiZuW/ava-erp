import { expect, test } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  E2E_NAME_PREFIX,
  loadTestEnv,
  purgeE2eMasterData,
  purgeTestUsers,
  type TestEnv,
  type TestUser,
} from "../scripts/lib/test-users";
import { signInAndEnroll } from "./helpers";

/**
 * Master data against the DEV project (phase 3). Only fictitious companies named "E2E …";
 * they are removed afterwards (D22: no personal data on the dev project).
 */
const env: TestEnv | null = loadTestEnv({ optional: true });

test.describe.serial("master data", () => {
  test.skip(!env, "Supabase test credentials are not configured (.env.local) – skipped.");
  test.setTimeout(120_000);
  test.use({ actionTimeout: 15_000 });

  let user: TestUser | null = null;

  test.beforeAll(async () => {
    await purgeE2eMasterData(env!);
    await purgeTestUsers(env!, "e2e-md");
    user = await createTestUser(env!, "e2e-md", { admin: true });
  });

  test.afterAll(async () => {
    await purgeE2eMasterData(env!);
    await deleteTestUser(env!, user);
  });

  test("customer: invalid IČO → valid → contact → detail → history; foreign supplier warning", async ({
    page,
  }) => {
    const name = `${E2E_NAME_PREFIX}Zákazník ${Date.now()}`;
    await signInAndEnroll(page, user!);

    // new customer from the "+ Nové" menu
    await page.getByRole("button", { name: "+ Nové" }).click();
    await page.getByRole("link", { name: "Zákazník" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zákazníci");
    await page.getByLabel("Názov / meno").fill(name);
    await page.getByLabel("IČO").fill("12345678");
    await page.getByRole("button", { name: "Uložiť" }).click();
    await expect(page.getByText(/IČO nie je platné/)).toBeVisible();

    await page.getByLabel("IČO").fill("");
    await page.getByLabel("Mesto").fill("Bratislava");
    await page.getByRole("button", { name: "Uložiť" }).click();
    await expect(page).toHaveURL(/\/zakaznici\/detail\/\?id=[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByText(name).first()).toBeVisible();

    // a general company contact (D22) – the personal-data note is shown
    await page.getByRole("button", { name: "Pridať kontakt" }).click();
    await expect(page.getByTestId("contact-privacy-note")).toContainText("osobné údaje");
    await page.getByLabel("Meno alebo označenie").fill("Objednávky");
    await page.getByLabel("E-mail").fill("objednavky@e2e.test.invalid");
    await page.getByRole("button", { name: "Uložiť kontakt" }).click();
    const contacts = page.getByRole("region", { name: "Kontakty" });
    await expect(contacts.getByText("Objednávky")).toBeVisible({ timeout: 15_000 });

    // history shows the creation of the customer and of the contact
    const history = page.getByRole("region", { name: "História zmien" });
    await expect(history.getByText(/Kontakt: Objednávky/).first()).toBeVisible({ timeout: 15_000 });

    // list + search
    await page.goto("/zakaznici/");
    await page.getByRole("searchbox").fill(name);
    await expect(page.getByRole("link", { name })).toBeVisible({ timeout: 15_000 });

    // foreign supplier
    await page.goto("/dodavatelia/detail/?id=new");
    await page.getByLabel("Názov / meno").fill(`${E2E_NAME_PREFIX}GmbH ${Date.now()}`);
    await page.getByLabel("Krajina").fill("DE");
    await expect(page.getByTestId("foreign-supplier-warning")).toBeVisible();
    await page.getByRole("button", { name: "Uložiť" }).click();
    await expect(page).toHaveURL(/\/dodavatelia\/detail\/\?id=[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByTestId("foreign-supplier-warning")).toBeVisible();
  });
});
