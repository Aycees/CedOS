import { expect, test } from "@playwright/test";

import { E2E_EMAIL } from "./account";
import { resetE2EData } from "./reset";

/**
 * Product spec §3 — Home.
 *
 * Home reads from every other module, so its assertions are only meaningful
 * against a known state. Other spec files' fixtures are self-contained and
 * don't depend on data surviving into later files (each uses a unique name
 * and asserts within its own test), so resetting here — the same utility
 * auth.setup uses — is safe and is what makes the "calm empty state" case
 * checkable at all.
 */
const unique = (label: string) => `${label} ${Date.now()}`;

test.describe("Home", () => {
  test.beforeAll(async () => {
    await resetE2EData(E2E_EMAIL);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("an empty day reads calm in every card, not as an error", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByText("nothing on the calendar today")).toBeVisible();
    await expect(page.getByText("no tasks for today")).toBeVisible();
    await expect(page.getByText("nothing due today")).toBeVisible();
    await expect(page.getByText("no budgets set")).toBeVisible();
    await expect(page.getByText("no trip planned")).toBeVisible();
  });

  test("completing a task from Home updates the count without a reload", async ({ page }) => {
    const title = unique("Water the plants");

    await page.goto("/tasks");
    const input = page.getByLabel("Add a task to today");
    await input.fill(title);
    await input.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(title)).toBeVisible();

    await page.getByRole("checkbox", { name: `Complete ${title}` }).click();
    await expect(page.getByText(title)).toBeHidden();
  });
});
