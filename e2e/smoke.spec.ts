import { expect, test } from "@playwright/test";

// Anonymous visitor: nothing of the application is shown without signing in.

test("the dashboard redirects an anonymous visitor to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/prihlasenie\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prihlásenie");
  await expect(page.getByRole("navigation", { name: "Hlavná navigácia" })).toHaveCount(0);
});

test("a section keeps its return path and survives a reload", async ({ page }) => {
  await page.goto("/zakazky/");
  await expect(page).toHaveURL(/\/prihlasenie\/\?next=%2Fzakazky%2F$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prihlásenie");
});

test("settings are not reachable without signing in", async ({ page }) => {
  await page.goto("/nastavenia/");
  await expect(page).toHaveURL(/\/prihlasenie\/\?next=%2Fnastavenia%2F$/);
  await expect(page.getByText("Firma")).toHaveCount(0);
});

test("TOTP pages without a session send the visitor to sign-in", async ({ page }) => {
  await page.goto("/prihlasenie/overenie/");
  await expect(page).toHaveURL(/\/prihlasenie\/$/);
  await page.goto("/prihlasenie/registracia-faktora/");
  await expect(page).toHaveURL(/\/prihlasenie\/$/);
});

test("the sign-in form validates input before calling the server", async ({ page }) => {
  await page.goto("/prihlasenie/");
  await page.getByRole("button", { name: "Pokračovať" }).click();
  await expect(page.getByText("Zadajte e-mail.")).toBeVisible();
  await expect(page.getByText("Zadajte heslo.")).toBeVisible();
});
