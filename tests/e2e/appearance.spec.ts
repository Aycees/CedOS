import { expect, test } from "@playwright/test";

/**
 * Product spec §12 — the theming edge case the whole token architecture
 * exists to satisfy: changes must apply instantly and platform-wide,
 * "including inside open modals — no stale-themed surfaces."
 */

test("theme, accent and density apply platform-wide", async ({ page }) => {
  await page.goto("/settings");
  const root = page.locator("html");

  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "green" }).click();
  await expect(root).toHaveAttribute("data-accent", "green");

  await page.getByRole("radio", { name: "Compact" }).click();
  await expect(root).toHaveAttribute("data-density", "compact");

  // Density is a real spacing change, not just an attribute.
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--row-pad").trim(),
      ),
    )
    .toBe("7px");

  // Restore, so the suite leaves the account as it found it.
  await page.getByRole("radio", { name: "Paper" }).click();
  await page.getByRole("button", { name: "terracotta" }).click();
  await page.getByRole("radio", { name: "Comfortable" }).click();
});

test("an open modal rethemes with everything else", async ({ page }) => {
  await page.goto("/journal");
  await page.getByRole("button", { name: "+ new entry" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const paperBackground = await dialog.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );

  // Retheme while the modal is open — exactly what the spec's edge case
  // describes. The provider's only mechanism is this attribute.
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });

  await expect
    .poll(() => dialog.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(paperBackground);

  // The dark card token, proving the modal read the token layer rather than
  // a value baked in when it mounted.
  await expect
    .poll(() => dialog.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(47, 46, 43)");
});

test("the appearance survives a reload", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Persisted to UserSettings and server-rendered on the way back, so there
  // is no flash to correct.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("radio", { name: "Paper" }).click();
  await page.waitForTimeout(800);
});
