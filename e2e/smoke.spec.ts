import { expect, test } from "@playwright/test";

test("dashboard skeleton loads with 14 menu items", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prehľad");
  await expect(
    page.getByRole("navigation", { name: "Hlavná navigácia" }).getByRole("link"),
  ).toHaveCount(14);
});

test("navigation to a section shows the placeholder and survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Zákazky" }).click();
  await expect(page).toHaveURL(/\/zakazky\/$/);
  await expect(page.getByText("Pripravujeme").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zákazky");
});

test("Ctrl+K opens the command palette", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await expect(page.getByPlaceholder("Kam chcete ísť?")).toBeVisible();
  await page.getByRole("option", { name: "Faktúry" }).click();
  await expect(page).toHaveURL(/\/faktury\/$/);
});
