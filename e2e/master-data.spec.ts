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

    // --- catalog -------------------------------------------------------------------------------
    const stamp = Date.now();
    const goods = `${E2E_NAME_PREFIX}Hrnček ${stamp}`;
    const pkg = `${E2E_NAME_PREFIX}Balíček ${stamp}`;

    // items: one goods item, one package (via "+ Nové")
    await page.getByRole("button", { name: "+ Nové" }).click();
    await page.getByRole("link", { name: "Položka katalógu" }).click();
    await page.getByLabel("Názov", { exact: true }).fill(goods);
    await page.getByLabel("Nákupná cena / jednotka", { exact: true }).fill("2,50");
    await page.getByRole("button", { name: "Uložiť" }).click();
    await expect(page.getByRole("button", { name: goods, exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "+ Nová položka" }).click();
    const itemForm = page.getByRole("region", { name: "Nová položka katalógu" });
    await itemForm.getByLabel("Názov", { exact: true }).fill(pkg);
    await itemForm.getByLabel("Typ", { exact: true }).selectOption("package");
    await itemForm.getByLabel("Jednotka", { exact: true }).selectOption("bal");
    await page.getByRole("button", { name: "Uložiť" }).click();
    await expect(page.getByRole("button", { name: pkg, exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // package BOM: a package is never offered as a component (one level)
    await page.goto("/katalog/?tab=balicky");
    await page.getByLabel("Balíček", { exact: true }).selectOption({ label: pkg });
    const componentSelect = page.getByLabel("Komponent", { exact: true });
    await expect(componentSelect.locator("option", { hasText: pkg })).toHaveCount(0);
    await componentSelect.selectOption({ label: `${goods} (ks)` });
    await page.getByLabel("Množstvo", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Pridať", exact: true }).click();
    await expect(page.getByRole("region", { name: "Náklad 1 balíčka" })).toContainText("5,00 €", {
      timeout: 15_000,
    });

    // labour rates: an overlapping period is refused with a clear message
    await page.goto("/katalog/?tab=sadzby");
    const role = `${E2E_NAME_PREFIX}Konzultant ${stamp}`;
    await page.getByLabel("Názov roly", { exact: true }).fill(role);
    await page.getByRole("button", { name: "Pridať rolu" }).click();
    const roleTile = page.getByRole("region", { name: role });
    await expect(roleTile).toBeVisible({ timeout: 15_000 });
    for (const [from, cost] of [
      ["01/01/2026", "40"],
      ["01/06/2026", "45"],
    ]) {
      await roleTile.getByRole("button", { name: "Nová sadzba" }).click();
      await roleTile.getByLabel("Kalkulačná sadzba / h", { exact: true }).fill(cost);
      await roleTile.getByLabel("Fakturovaná sadzba / h", { exact: true }).fill("60");
      await roleTile.getByLabel("Platí od", { exact: true }).fill(from);
      await roleTile.getByRole("button", { name: "Uložiť sadzbu" }).click();
      if (from === "01/01/2026") {
        await expect(roleTile.getByRole("cell", { name: /01\/01\/2026/ })).toBeVisible({
          timeout: 15_000,
        });
      }
    }
    await expect(roleTile.getByText(/prekrýva s inou sadzbou/)).toBeVisible({ timeout: 15_000 });

    // resources: cost rate computed by the database matches the preview
    await page.goto("/katalog/?tab=zdroje");
    const resource = `${E2E_NAME_PREFIX}Plotter ${stamp}`;
    await page.getByRole("button", { name: "+ Nový zdroj" }).click();
    await page.getByLabel("Názov", { exact: true }).fill(resource);
    await page.getByLabel("Obstarávacia cena", { exact: true }).fill("10 000");
    await page.getByLabel("Predpokladaná životnosť", { exact: true }).fill("3000");
    await page.getByLabel("Prevádzkové náklady / h", { exact: true }).fill("1,50");
    await expect(page.getByTestId("resource-rate-preview")).toHaveText("4,83 €");
    await page.getByRole("button", { name: "Uložiť" }).click();
    const row = page.getByRole("row", { name: new RegExp(resource) });
    await expect(row).toContainText("4,83 €", { timeout: 15_000 });

    // --- content library: slots are shown (writes are covered by pgTAP / API tests, the slots
    //     hold the owner's real texts on dev) ----------------------------------------------------
    await page.goto("/dokumenty/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dokumenty");
    for (const title of [
      "O firme",
      "Prečo my",
      "Ako pracujeme",
      "Kontakt",
      "Inžinierske služby",
      "Reklamné predmety",
    ]) {
      await expect(page.getByRole("region", { name: title, exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }
    await expect(page.getByRole("region", { name: "Diely a servis CNC", exact: true })).toHaveCount(
      0,
    );

    // --- settings → reporting: overhead; a duplicate for the whole company is refused -----------
    await page.goto("/nastavenia/");
    const overhead = page.getByRole("region", { name: "Réžia – mesačné fixné náklady" });
    const category = `${E2E_NAME_PREFIX}réžia ${stamp}`;
    for (let i = 0; i < 2; i++) {
      await overhead.getByRole("button", { name: "Pridať náklad" }).click();
      await overhead.getByLabel("Kategória", { exact: true }).fill(category);
      await overhead.getByLabel("Suma za mesiac", { exact: true }).fill("123,45");
      await overhead.getByRole("button", { name: "Uložiť", exact: true }).click();
      if (i === 0) {
        await expect(overhead.getByRole("cell", { name: category, exact: true })).toBeVisible({
          timeout: 15_000,
        });
      }
    }
    await expect(overhead.getByText(/už v danom mesiaci a divízii existuje/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tax-warning")).toContainText("overte ich s účtovníkom");
  });
});
