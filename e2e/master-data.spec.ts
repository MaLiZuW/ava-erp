import { expect, test } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  E2E_NAME_PREFIX,
  loadTestEnv,
  makeE2eOverheadReviewOverdue,
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
    // the units are loaded before saving (slow dev project when suites run in parallel)
    await expect(
      page.getByLabel("Jednotka", { exact: true }).locator('option[value="ks"]'),
    ).toHaveCount(1);
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
    // unit and unit price of the chosen component are shown before adding
    await expect(page.getByTestId("component-unit-price")).toContainText("2,50");
    await page.getByLabel("Množstvo", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Pridať", exact: true }).click();
    const cost = page.getByRole("region", { name: "Náklad 1 balíčka" });
    await expect(cost).toContainText("5,00 €", { timeout: 15_000 });

    // BOM row: unit price column; cost = quantity × unit price
    const bomRow = page.getByRole("row", { name: new RegExp(goods) });
    await expect(bomRow).toContainText("2,50 €");

    // NumberStepper: quick + + = ONE save after a pause → one history entry "2 → 4" with names
    const qty = page.getByLabel(`Množstvo – ${goods}`, { exact: true });
    const plus = page.getByRole("button", { name: `Zvýšiť – Množstvo – ${goods}` });
    await plus.click();
    await plus.click();
    await expect(qty).toHaveValue("4");
    await expect(cost).toContainText("10,00 €", { timeout: 15_000 });
    const catalogHistory = page.getByRole("region", { name: "História zmien" });
    const bomEntries = catalogHistory
      .getByRole("listitem")
      .filter({ hasText: `Kusovník: ${pkg} ← ${goods}` });
    await expect(bomEntries.filter({ hasText: "Zmenené" })).toHaveCount(1, { timeout: 15_000 });
    await expect(bomEntries.filter({ hasText: "Zmenené" })).toContainText("4");
    await expect(catalogHistory).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/); // no raw UUIDs
    await page.getByRole("button", { name: `Znížiť – Množstvo – ${goods}` }).click();
    await page.getByRole("button", { name: `Znížiť – Množstvo – ${goods}` }).click();
    await expect(qty).toHaveValue("2");
    await expect(cost).toContainText("5,00 €", { timeout: 15_000 });

    // the change history is the last section of the page (DESIGN_SYSTEM principle 8)
    const lastRegion = await page
      .locator("main section[aria-label]")
      .evaluateAll((els) => els.at(-1)?.getAttribute("aria-label"));
    expect(lastRegion).toBe("História zmien");

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

    // equipment ("Technika a vybavenie", formerly "Zdroje"): the old link still works
    await page.goto("/katalog/?tab=zdroje");
    await expect(
      page.getByRole("button", { name: "Technika a vybavenie", pressed: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Technika a vybavenie", exact: true }),
    ).toBeVisible();
    // new equipment from "+ Nové"; cost rate computed by the database matches the preview
    await page.getByRole("button", { name: "+ Nové" }).click();
    await page.getByRole("link", { name: "Technika a vybavenie" }).click();
    await expect(page).toHaveURL(/tab=technika&nova=1/);
    const resource = `${E2E_NAME_PREFIX}Plotter ${stamp}`;
    await page.getByLabel("Názov", { exact: true }).fill(resource);
    await page.getByLabel("Obstarávacia cena", { exact: true }).fill("10 000");
    // life hours: step 100 h – "+" from 2900 gives 3000
    const life = page.getByLabel("Predpokladaná životnosť", { exact: true });
    await life.fill("2900");
    await page.getByRole("button", { name: "Zvýšiť – Predpokladaná životnosť" }).click();
    await expect(life).toHaveValue("3000");
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
    await page.goto("/nastavenia/reporting/rezia/");
    // settings tiles have no own title on their page; the primary button sits in the sticky header
    const overhead = page.locator("main");
    const category = `${E2E_NAME_PREFIX}réžia ${stamp}`;
    await overhead.getByRole("button", { name: "Jednorazové", exact: true }).click();
    for (let i = 0; i < 2; i++) {
      await page
        .getByTestId("header-action")
        .getByRole("button", { name: "Pridať náklad" })
        .click();
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

    // --- recurring overhead (block I): new amount from next month, this month keeps the old one --
    const rec = `${E2E_NAME_PREFIX}nájom ${stamp}`;
    await overhead.getByRole("button", { name: "Opakované", exact: true }).click();
    await page
      .getByTestId("header-action")
      .getByRole("button", { name: "Pridať opakovaný náklad" })
      .click();
    await overhead.getByLabel("Kategória", { exact: true }).fill(rec);
    await overhead.getByLabel("Suma za obdobie", { exact: true }).fill("100");
    await overhead.getByRole("button", { name: "Uložiť opakovaný náklad" }).click();
    const recRows = overhead.getByTestId("recurring-row").filter({ hasText: rec });
    await expect(recRows).toHaveCount(1, { timeout: 15_000 });
    await recRows.getByRole("button", { name: "Zmeniť sumu od…" }).click();
    await recRows.getByLabel("Nová suma za obdobie").fill("150");
    await recRows.getByRole("button", { name: "Uložiť novú verziu" }).click();
    // the old version runs to the end of this month, the new one starts next month
    await expect(recRows).toHaveCount(2, { timeout: 15_000 });
    await expect(recRows.filter({ hasText: "Platí od budúceho obdobia" })).toContainText("150,00");

    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const mm = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    await overhead.getByRole("button", { name: "Jednorazové", exact: true }).click();
    const monthRow = overhead.getByTestId("overhead-row-recurring").filter({ hasText: rec });
    await expect(monthRow).toContainText("100,00", { timeout: 15_000 });
    await overhead.getByLabel("Mesiac", { exact: true }).selectOption({ label: mm(next) });
    await expect(monthRow).toContainText("150,00", { timeout: 15_000 });

    // --- data review: overdue → dashboard tile → "Potvrdiť bez zmeny" moves the date --------------
    await makeE2eOverheadReviewOverdue(env!);
    await page.goto("/");
    await expect(page.getByTestId("dashboard-reviews")).toContainText(rec, { timeout: 15_000 });
    await page.goto("/nastavenia/data/");
    const due = page.getByTestId("review-row").filter({ hasText: rec });
    await expect(due).toHaveCount(2, { timeout: 15_000 });
    await expect(due.first()).toContainText("Po termíne");
    await due
      .first()
      .getByRole("button", { name: /^Potvrdiť bez zmeny/ })
      .click();
    await expect(due).toHaveCount(1, { timeout: 15_000 });

    await page.goto("/nastavenia/reporting/dane/");
    await expect(page.getByTestId("tax-warning")).toContainText("overte ich s účtovníkom");
    await page.goto("/nastavenia/reporting/kapacity/");

    // --- capacity calendar (block H): pattern → month total; vacation → 0 h; extra on a holiday ---
    const cal = page.locator("main");
    await cal.getByLabel("Osoba", { exact: true }).selectOption({ label: "Test e2e-md" });
    // default pattern for a new person is 8 h Mon–Fri; it is valid from today
    await cal.getByRole("button", { name: "Uložiť vzor" }).click();
    await expect(cal.getByText(/Vzor je uložený/)).toBeVisible({ timeout: 15_000 });

    // go to December (contains 24–26 December, days of rest)
    for (let i = 0; i < 13; i++) {
      if ((await cal.getByTestId("capacity-month").textContent())?.startsWith("12/")) break;
      await cal.getByRole("button", { name: "Nasledujúci mesiac" }).click();
    }
    const year = (await cal.getByTestId("capacity-month").textContent())!.slice(3);
    const christmas = cal.locator(`[data-day="${year}-12-24"]`);
    await expect(christmas).toHaveAttribute("aria-label", /: 0 h – Sviatok: Štedrý deň/, {
      timeout: 15_000,
    });

    // the month total equals the sum of the day cells
    const dayHours = async () =>
      (
        await cal
          .locator("[data-day]")
          .evaluateAll((els) =>
            els.map((e) =>
              Number(
                (e.getAttribute("aria-label") ?? "")
                  .split(": ")[1]
                  ?.split(" h")[0]
                  .replace(",", "."),
              ),
            ),
          )
      ).reduce((s, n) => s + n, 0);
    const monthBadge = cal.getByText(/^Mesiac /);
    const before = await dayHours();
    await expect(monthBadge).toHaveText(`Mesiac ${String(before).replace(".", ",")} h`);

    // vacation on a working day with 8 h → 0 h, total − 8
    const workday = cal
      .locator("[data-day]")
      .filter({ has: page.getByText("8 h", { exact: true }) })
      .first();
    const workdayDate = await workday.getAttribute("data-day");
    await workday.click();
    await cal.getByLabel("Typ", { exact: true }).selectOption("vacation");
    await cal.getByRole("button", { name: "Pridať výnimku" }).click();
    await expect(cal.locator(`[data-day="${workdayDate}"]`)).toHaveAttribute(
      "aria-label",
      /: 0 h – Dovolenka/,
      {
        timeout: 15_000,
      },
    );
    await expect(monthBadge).toHaveText(`Mesiac ${String(before - 8).replace(".", ",")} h`);

    // extra hours on a holiday are added
    await christmas.click();
    await cal.getByLabel("Typ", { exact: true }).selectOption("extra");
    await cal.getByLabel("Hodiny za deň", { exact: true }).fill("2");
    await cal.getByRole("button", { name: "Pridať výnimku" }).click();
    await expect(christmas).toHaveAttribute(
      "aria-label",
      /: 2 h – Sviatok: Štedrý deň, Extra \+2 h/,
      {
        timeout: 15_000,
      },
    );

    // --- point 18: stepper values are never cut (1,5 / 12,5 / 999 at 1280 and 375 px) ---------
    const sample = [
      ["Pondelok", "1,5"],
      ["Utorok", "12,5"],
      ["Streda", "999"],
    ] as const;
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [day, value] of sample) {
        const field = cal.getByLabel(`Hodiny – ${day}`, { exact: true });
        await field.fill(value);
        await field.scrollIntoViewIfNeeded();
        const cut = await field.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(cut, `${value} at ${width} px`).toBe(false);
        // the whole stepper (− field +) fits into the tile, nothing cut off on the right
        const fits = await field.evaluate((el) => {
          const group = el.closest('[role="group"]')!.getBoundingClientRect();
          // the outer tile (sections inside it carry labels; the tile itself is the last <section>)
          const sections = [...document.querySelectorAll("main section")].filter((s) =>
            s.contains(el),
          );
          const tile = sections[0]!.getBoundingClientRect();
          return group.right <= tile.right + 0.5;
        });
        expect(fits, `stepper fits at ${width} px`).toBe(true);
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // --- point 19: date from the calendar, Esc, impossible date → error --------------------------
    const pattern = cal.getByRole("region", { name: "Týždenný vzor" });
    const from = pattern.getByLabel("Platí od", { exact: true });
    const picker = page.getByRole("dialog", { name: "Kalendár" });
    await pattern.getByRole("button", { name: "Vybrať dátum z kalendára" }).click();
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Dnes" }).click();
    const t = new Date();
    await expect(from).toHaveValue(
      `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`,
    );
    await pattern.getByRole("button", { name: "Vybrať dátum z kalendára" }).click();
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await from.fill("31/02/2026");
    for (const [day] of sample) await cal.getByLabel(`Hodiny – ${day}`, { exact: true }).fill("8");
    await pattern.getByRole("button", { name: "Uložiť vzor" }).click();
    await expect(pattern.getByText("Zadajte dátum „platí od“ v tvare DD/MM/YYYY.")).toBeVisible();
  });
});
