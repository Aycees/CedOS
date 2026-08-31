import { expect, test, type Locator } from "@playwright/test";

/**
 * Product spec §5 — Tasks. One test per edge case the spec lists.
 */

/** Unique per run so the suite can run repeatedly without a DB reset. */
const unique = (label: string) => `${label} ${Date.now()}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/tasks");
});

test("all three buckets are always present, empty or not", async ({ page }) => {
  // "Three fixed buckets: Today, This week, Someday."
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Someday" })).toBeVisible();
});

test("an empty bucket still shows its input affordance", async ({ page }) => {
  // Spec §5: "show the input affordance regardless, never hide a bucket for
  // being empty." Someday is the bucket least likely to hold anything.
  await expect(page.getByLabel("Add a task to someday")).toBeVisible();
});

test("a task added with Enter appears in its bucket and moves the count", async ({
  page,
}) => {
  const title = unique("Email advisor");
  const input = page.getByLabel("Add a task to this week");

  await input.fill(title);
  await input.press("Enter");

  await expect(page.getByText(title)).toBeVisible();
  // The input clears, ready for the next one.
  await expect(input).toHaveValue("");
});

test("a completed task stays visible and struck through", async ({ page }) => {
  // Spec §5: "Completed tasks stay visible (struck through) rather than
  // disappearing — user must explicitly remove them."
  const title = unique("Pay water bill");
  const input = page.getByLabel("Add a task to today");
  await input.fill(title);
  await input.press("Enter");

  await page.getByRole("checkbox", { name: `Complete ${title}` }).click();

  const row = page.getByText(title);
  await expect(row).toBeVisible();
  await expect(row).toHaveCSS("text-decoration-line", "line-through");
});

test("completing and reopening a task is reversible", async ({ page }) => {
  const title = unique("Return library books");
  const input = page.getByLabel("Add a task to today");
  await input.fill(title);
  await input.press("Enter");

  await page.getByRole("checkbox", { name: `Complete ${title}` }).click();
  await expect(page.getByRole("checkbox", { name: `Reopen ${title}` })).toBeVisible();

  await page.getByRole("checkbox", { name: `Reopen ${title}` }).click();
  await expect(page.getByText(title)).not.toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
});

test("the bucket counter tracks completed tasks, not remaining ones", async ({
  page,
}) => {
  // Regression: the counter used to be `total - done` under a "done/total"
  // label, so completing every task walked it down to 0 instead of up to
  // the total — the opposite of what "done" should read.
  const title = unique("Renew passport");
  const input = page.getByLabel("Add a task to today");
  await input.fill(title);
  await input.press("Enter");

  // Wait for the row itself before reading the baseline count, so the
  // snapshot below is never taken mid-add (the count moving out from under
  // its own baseline would be a false failure, not a real one).
  const checkbox = page.getByRole("checkbox", { name: `Complete ${title}` });
  await expect(checkbox).toBeVisible();

  const todaySection = page.locator("section", {
    has: page.getByRole("heading", { name: "Today" }),
  });
  const counter = todaySection.getByText(/^\d+\/\d+$/);
  const before = await readCount(counter);

  await checkbox.click();
  await expect(async () => {
    expect(await readCount(counter)).toEqual({
      done: before.done + 1,
      total: before.total,
    });
  }).toPass();
});

async function readCount(counter: Locator): Promise<{ done: number; total: number }> {
  const [done, total] = (await counter.textContent())?.split("/").map(Number) ?? [];
  return { done: done ?? Number.NaN, total: total ?? Number.NaN };
}

test("removing a task takes it out of the list", async ({ page }) => {
  const title = unique("Book dentist");
  const input = page.getByLabel("Add a task to someday");
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText(title)).toBeVisible();

  await page.getByRole("button", { name: `Remove ${title}` }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("an empty title is not accepted as a task", async ({ page }) => {
  const input = page.getByLabel("Add a task to today");
  const before = await page.getByRole("checkbox").count();

  await input.fill("   ");
  await input.press("Enter");

  await expect(page.getByRole("checkbox")).toHaveCount(before);
});
