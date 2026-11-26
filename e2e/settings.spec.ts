import { expect, test, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loadTestEnv,
  purgeTestUsers,
  type TestEnv,
  type TestUser,
} from "../scripts/lib/test-users";
import { signInAndEnroll } from "./helpers";

/**
 * Settings mode (owner's points 20–22): the left panel switches to the settings menu,
 * sticky header, back to the app, readable history, Ctrl+K, mobile list first.
 * SHOTS_DIR=<folder> also saves screenshots at 1440 / 1024 / 375 px.
 */
const env: TestEnv | null = loadTestEnv({ optional: true });
const SHOTS = process.env.SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForLoadState("networkidle");
  // skeletons and "Načítavam…" gone (data loaded) before the picture
  await expect(page.locator("main .animate-pulse")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator("main").getByText("Načítavam…")).toHaveCount(0, { timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

test.describe.serial("settings mode", () => {
  test.skip(!env, "Supabase test credentials are not configured (.env.local) – skipped.");
  test.setTimeout(150_000);
  test.use({ actionTimeout: 15_000 });

  let user: TestUser | null = null;
  test.beforeAll(async () => {
    await purgeTestUsers(env!, "e2e-set");
    user = await createTestUser(env!, "e2e-set", { admin: true });
  });
  test.afterAll(async () => {
    await deleteTestUser(env!, user);
  });

  test("menu switch, sticky header, back to the app, history, Ctrl+K, mobile", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAndEnroll(page, user!);
    await page.goto("/katalog/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Katalóg");

    // entering the settings switches the left panel to the settings menu
    await page.getByRole("link", { name: "Nastavenia" }).click();
    await expect(page).toHaveURL(/\/nastavenia\/$/);
    const menu = page.getByRole("navigation", { name: "Menu nastavení" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Hlavná navigácia" })).toHaveCount(0);
    for (const title of [
      "Firma",
      "Bezpečnosť",
      "Systém",
      "AI",
      "Reporting",
      "Dáta",
      "História zmien",
    ]) {
      await expect(page.getByRole("region", { name: title, exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }
    await shot(page, "settings-overview-1440");

    // a section: breadcrumb, title, primary button in the sticky header, no duplicate tile title
    await menu.getByRole("link", { name: /^Logo/ }).click();
    await expect(page).toHaveURL(/\/nastavenia\/firma\/logo\/$/);
    await expect(menu.getByRole("link", { name: /^Logo/ })).toHaveAttribute("aria-current", "page");
    const header = page.getByTestId("page-header");
    await expect(header.getByRole("navigation", { name: "Navigačná cesta" })).toHaveText(
      /Nastavenia\s*\/\s*Firma/,
    );
    await expect(header.getByRole("heading", { level: 1 })).toHaveText("Logo");
    await expect(
      header.getByTestId("header-action").getByRole("button", { name: "Nahrať logo" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Logo · Nastavenia · Add Value Agency");
    await expect(
      page.locator("main").getByRole("heading", { name: "Logo", exact: true }),
    ).toHaveCount(0);
    await shot(page, "settings-logo-1440");

    // history of the logo: only logo entries, readable, no technical fields
    const history = page.getByRole("region", { name: "História zmien" });
    await expect(history).toBeVisible();
    await expect(history).not.toContainText("z bloku");
    await expect(history).not.toContainText(/Kontrolný súčet|Umiestnenie|sha256|storage/);
    const lastRegion = await page
      .locator("main section[aria-label]")
      .evaluateAll((els) => els.at(-1)?.getAttribute("aria-label"));
    expect(lastRegion).toBe("História zmien");

    // the header stays visible when the page scrolls
    await page.setViewportSize({ width: 1440, height: 500 });
    await menu.getByRole("link", { name: /^Kapacity/ }).click();
    await expect(header.getByRole("heading", { level: 1 })).toHaveText("Kapacity");
    await page.mouse.move(800, 400);
    await page.mouse.wheel(0, 1500);
    await expect(header.getByRole("heading", { level: 1 })).toBeInViewport();
    await page.setViewportSize({ width: 1440, height: 900 });

    // direct link + reload
    await page.goto("/nastavenia/system/funkcie/");
    await page.reload();
    await expect(header.getByRole("heading", { level: 1 })).toHaveText("Funkcie", {
      timeout: 15_000,
    });
    await expect(menu).toBeVisible();

    // Ctrl+K finds a field
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Kam chcete ísť?").fill("IBAN");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/nastavenia\/firma\/$/);

    // narrower screen: the settings menu keeps its labels
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(menu.getByRole("link", { name: /^Údaje firmy/ })).toBeVisible();
    await shot(page, "settings-company-1024");

    // back to the app: the last page and the main menu
    await page.getByRole("link", { name: "Späť do aplikácie" }).click();
    await expect(page).toHaveURL(/\/katalog\/$/);
    await expect(page.getByRole("navigation", { name: "Hlavná navigácia" })).toBeVisible();

    // mobile: the list of sections first, a section with "← Nastavenia"
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/nastavenia/");
    await expect(page.getByRole("region", { name: "Reporting", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "settings-overview-375");
    await page.getByRole("link", { name: "Kapacity →" }).click();
    await expect(page).toHaveURL(/\/nastavenia\/reporting\/kapacity\/$/);
    const back = header.getByRole("link", { name: "← Nastavenia" });
    await expect(back).toBeVisible();
    await shot(page, "settings-capacity-375");
    await back.click();
    await expect(page).toHaveURL(/\/nastavenia\/$/);
  });
});
