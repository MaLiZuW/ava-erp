import { expect, test } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loadTestEnv,
  purgeTestUsers,
  type TestEnv,
  type TestUser,
} from "../scripts/lib/test-users";
import { signInAndEnroll } from "./helpers";

/** Settings structure (owner's point 20): sub-pages, secondary menu, main menu, Ctrl+K, mobile. */
const env: TestEnv | null = loadTestEnv({ optional: true });

test.describe.serial("settings structure", () => {
  test.skip(!env, "Supabase test credentials are not configured (.env.local) – skipped.");
  test.setTimeout(120_000);
  test.use({ actionTimeout: 15_000 });

  let user: TestUser | null = null;
  test.beforeAll(async () => {
    await purgeTestUsers(env!, "e2e-set");
    user = await createTestUser(env!, "e2e-set", { admin: true });
  });
  test.afterAll(async () => {
    await deleteTestUser(env!, user);
  });

  test("overview, secondary menu, direct link, history per section, main menu, Ctrl+K, mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAndEnroll(page, user!);

    // overview: one tile per section with its description and state
    await page.goto("/nastavenia/");
    for (const title of [
      "Firma",
      "Používatelia a bezpečnosť",
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
    await expect(page.getByRole("region", { name: "AI", exact: true })).toContainText(
      "Pripravujeme",
    );

    // secondary menu → sub-page with its own address, active item, its history at the bottom
    const sections = page.getByRole("navigation", { name: "Sekcie nastavení" });
    await sections.getByRole("link", { name: "Logo" }).click();
    await expect(page).toHaveURL(/\/nastavenia\/firma\/logo\/$/);
    await expect(sections.getByRole("link", { name: "Logo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByTestId("settings-page-title").getByRole("heading", { name: "Logo" }),
    ).toBeVisible();
    const lastRegion = async () =>
      page
        .locator("main section[aria-label]")
        .evaluateAll((els) => els.at(-1)?.getAttribute("aria-label"));
    await expect.poll(lastRegion).toBe("História zmien");

    // direct link + reload keeps the page
    await page.goto("/nastavenia/system/funkcie/");
    await page.reload();
    await expect(
      page.getByTestId("settings-page-title").getByRole("heading", { name: "Funkcie" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("region", { name: "Funkcie", exact: true })).toBeVisible();

    // main menu (expanded): the groups of the settings below "Nastavenia"
    const subnav = page.getByTestId("settings-subnav");
    await expect(subnav).toBeVisible();
    await subnav.getByRole("link", { name: "Reporting" }).click();
    await expect(page).toHaveURL(/\/nastavenia\/reporting\/rezia\/$/);

    // Ctrl+K: a field name finds its page
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Kam chcete ísť?").fill("IBAN");
    await expect(page.getByRole("option", { name: /Údaje firmy/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/nastavenia\/firma\/$/);
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Kam chcete ísť?").fill("dovolenka");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/nastavenia\/reporting\/kapacity\/$/);

    // collapsed main menu: fly-out with the groups on keyboard focus
    await page.setViewportSize({ width: 1024, height: 800 });
    await page
      .getByRole("navigation", { name: "Nastavenia a profil" })
      .getByRole("link", { name: "Nastavenia" })
      .focus();
    const flyout = page.getByTestId("settings-flyout");
    await expect(flyout).toBeVisible();
    await flyout.getByRole("link", { name: "Systém" }).click();
    await expect(page).toHaveURL(/\/nastavenia\/system\/$/);

    // mobile: a select of the section instead of the side menu
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(sections).toBeHidden();
    await page.getByLabel("Sekcia nastavení").selectOption("/nastavenia/reporting/ciele-kpi/");
    await expect(page).toHaveURL(/\/nastavenia\/reporting\/ciele-kpi\/$/);
    await expect(
      page.getByTestId("settings-page-title").getByRole("heading", { name: "Ciele KPI" }),
    ).toBeVisible();
  });
});
