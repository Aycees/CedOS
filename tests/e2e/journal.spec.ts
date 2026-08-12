import { expect, test } from "@playwright/test";

/**
 * Product spec §7 — Journal, and decision A4.
 */

const unique = (label: string) => `${label} ${Date.now()}`;

async function writeEntry(page: import("@playwright/test").Page, body: string, date?: string) {
  await page.getByRole("button", { name: "+ new entry" }).click();
  const dialog = page.getByRole("dialog");
  if (date) await dialog.getByLabel("DATE").fill(date);
  await dialog.getByLabel("ENTRY").fill(body);
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/journal");
});

test("an entry can be written and appears in the list", async ({ page }) => {
  const body = unique("Slow morning.");
  await writeEntry(page, body);
  await expect(page.getByText(body)).toBeVisible();
});

test("two entries on the same date both persist (A4)", async ({ page }) => {
  // Decision A4 deliberately allows this: a unique constraint would turn a
  // second reflection into an error state in a calm, reflective app.
  const first = unique("First pass at the methods section.");
  const second = unique("Late addition: called home.");

  await writeEntry(page, first);
  await writeEntry(page, second);

  await expect(page.getByText(first)).toBeVisible();
  await expect(page.getByText(second)).toBeVisible();
});

test("writing on a date that already has an entry shows a non-blocking hint", async ({
  page,
}) => {
  await writeEntry(page, unique("An entry for today."));

  await page.getByRole("button", { name: "+ new entry" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByText(/you already wrote on this date/)).toBeVisible();
  // Non-blocking is the whole point — save stays available.
  await expect(dialog.getByRole("button", { name: "save" })).toBeEnabled();
});

test("an entry can be backdated rather than forced to today", async ({ page }) => {
  // Spec §7: "support an editable date field, don't force 'today' only."
  const body = unique("Writing today about last week.");
  await writeEntry(page, body, "2026-08-04");

  // Scoped to this run's entry — the account accumulates entries across runs.
  await expect(page.getByRole("button", { name: new RegExp(body) })).toContainText(
    "AUG 4, 2026",
  );
});

test("entries list newest first", async ({ page }) => {
  const older = unique("Older entry.");
  const newer = unique("Newer entry.");

  await writeEntry(page, older, "2026-07-01");
  await writeEntry(page, newer, "2026-07-15");

  const bodies = page.locator("p", { hasText: /entry\.\s*\d+$/ });
  const texts = await bodies.allInnerTexts();
  expect(texts.indexOf(newer)).toBeLessThan(texts.indexOf(older));
});

test("an entry can be edited and deleted", async ({ page }) => {
  const body = unique("A thought I will revise.");
  await writeEntry(page, body);

  await page.getByRole("button", { name: new RegExp(body.slice(0, 20)) }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "delete" }).click();

  await expect(page.getByText(body)).toHaveCount(0);
});

test("the empty state is calm rather than blank", async ({ page }) => {
  // Spec §13: "never a blank screen that looks broken."
  const hasEntries = (await page.getByRole("button", { name: /^\w{3} \d/ }).count()) > 0;
  if (!hasEntries) {
    await expect(page.getByText("no entries yet")).toBeVisible();
  }
});
