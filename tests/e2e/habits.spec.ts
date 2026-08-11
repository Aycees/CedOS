import { expect, test, type Page } from "@playwright/test";

/**
 * Product spec §8 — Habits, at the UI level.
 *
 * The date maths itself is covered exhaustively by Vitest against the pure
 * engine (src/modules/habits/engine/cadence.test.ts), because testing interval
 * arithmetic through a browser would be slow and imprecise (system design
 * §8.3). What is left for here is the behaviour a person can see.
 */

const unique = (label: string) => `${label} ${Date.now()}${Math.floor(Math.random() * 99)}`;

async function newHabit(
  page: Page,
  name: string,
  opts: {
    cadence?: string;
    weekdays?: number[];
    count?: { target: number; unit: string };
  } = {},
) {
  await page.getByRole("button", { name: "+ new habit" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Habit name").fill(name);
  if (opts.cadence) await dialog.getByRole("radio", { name: opts.cadence }).click();

  if (opts.weekdays) {
    // The picker defaults to Mon–Fri, so toggle towards the requested set.
    for (let day = 1; day <= 7; day += 1) {
      const button = dialog.getByRole("button", { name: `day ${day}` });
      const on = (await button.getAttribute("aria-pressed")) === "true";
      if (on !== opts.weekdays.includes(day)) await button.click();
    }
  }

  if (opts.count) {
    await dialog.getByRole("radio", { name: "Count" }).click();
    await dialog.getByLabel("Target").fill(String(opts.count.target));
    await dialog.getByLabel("Unit").fill(opts.count.unit);
  }
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/habits");
});

test("with no habits the day reads as nothing due, not as an error", async ({
  page,
}) => {
  // Product spec §8: "No habits due on a given day — today view shows a clear
  // 'nothing due' state, not an empty-looking error."
  const hasHabits = await page.getByRole("checkbox").count();
  test.skip(hasHabits > 0, "account already has habits due today");
  await expect(page.getByText("nothing due today")).toBeVisible();
});

test("a daily habit can be completed and undone", async ({ page }) => {
  const name = unique("Morning pages");
  await newHabit(page, name);

  await page.getByRole("checkbox", { name: `Complete ${name}` }).click();
  const row = page.getByText(name, { exact: true });
  await expect(row).toHaveCSS("text-decoration-line", "line-through");
  await expect(page.getByText(/DONE|Done/).first()).toBeVisible();

  await page.getByRole("checkbox", { name: `Undo ${name}` }).click();
  await expect(row).not.toHaveCSS("text-decoration-line", "line-through");
});

test("a skipped habit is tracked differently from one simply not done", async ({
  page,
}) => {
  // Product spec §8 wants skip and not-done to be distinguishable; the schema
  // records only LOGGED and SKIPPED, and absence means not done.
  const name = unique("Standup");
  await newHabit(page, name);

  await page.getByRole("button", { name: `Skip ${name}` }).click();

  const row = page.getByRole("button", { name: `Edit ${name}` });
  await expect(row).toContainText("skipped");
  // Skipping is not completing: no strike-through, and it does not count as done.
  await expect(page.getByText(name, { exact: true })).not.toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
});

test("a measured habit gives partial credit without marking the day done", async ({
  page,
}) => {
  const name = unique("Water");
  await newHabit(page, name, { count: { target: 8, unit: "glasses" } });

  await page.getByLabel(`Amount for ${name}`).fill("4");
  await page.getByRole("button", { name: `Log ${name}` }).click();

  const row = page.getByRole("button", { name: `Edit ${name}` });
  await expect(row.locator("..")).toContainText("50%");
  await expect(page.getByRole("checkbox", { name: `Complete ${name}` })).toBeVisible();
});

test("a measured habit logged above target reads as over 100%, not capped", async ({
  page,
}) => {
  // Product spec §8: "Count-based habit logged above target — treat as 100%+
  // complete, don't cap display oddly."
  const name = unique("Pages");
  await newHabit(page, name, { count: { target: 20, unit: "pages" } });

  await page.getByLabel(`Amount for ${name}`).fill("30");
  await page.getByRole("button", { name: `Log ${name}` }).click();

  await expect(
    page.getByRole("button", { name: `Edit ${name}` }).locator(".."),
  ).toContainText("150%");
});

test("archiving removes a habit from today but keeps its history", async ({
  page,
}) => {
  const name = unique("Retired habit");
  await newHabit(page, name);
  await page.getByRole("checkbox", { name: `Complete ${name}` }).click();

  await page.getByRole("button", { name: `Edit ${name}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "archive" }).click();
  await expect(dialog).toBeHidden();

  // Gone from today…
  await expect(page.getByRole("checkbox", { name: new RegExp(name) })).toHaveCount(0);

  // …but the history it accumulated survives (spec §8: soft-remove keeps history).
  await page.getByRole("radio", { name: "History" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
});

test("a weekday habit appears only on the days it is due", async ({ page }) => {
  /*
   * Anchored to the app's own idea of today — read from the sidebar — rather
   * than the test machine's clock, because "today" is resolved in the user's
   * timezone and the two can disagree. Picking the weekday sets relative to
   * it makes this deterministic on any day of the week.
   */
  const sidebar = await page.locator('a[href="/profile"]').innerText();
  const abbreviations = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const todayIso = abbreviations.findIndex((day) => sidebar.includes(day)) + 1;
  expect(todayIso).toBeGreaterThan(0);

  const tomorrowIso = (todayIso % 7) + 1;

  const dueToday = unique("Due today");
  await newHabit(page, dueToday, { cadence: "By day", weekdays: [todayIso] });
  await expect(page.getByRole("checkbox", { name: `Complete ${dueToday}` })).toHaveCount(
    1,
  );

  const dueTomorrow = unique("Due tomorrow");
  await newHabit(page, dueTomorrow, { cadence: "By day", weekdays: [tomorrowIso] });
  // Product spec §8: a habit not due today simply is not on the list.
  await expect(
    page.getByRole("checkbox", { name: `Complete ${dueTomorrow}` }),
  ).toHaveCount(0);
});

test("a habit can be deleted outright", async ({ page }) => {
  const name = unique("Disposable habit");
  await newHabit(page, name);

  await page.getByRole("button", { name: `Edit ${name}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "delete" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("checkbox", { name: new RegExp(name) })).toHaveCount(0);
});

test("the history grid shows one row per habit with its streaks", async ({ page }) => {
  const name = unique("Tracked");
  await newHabit(page, name);
  await page.getByRole("checkbox", { name: `Complete ${name}` }).click();

  await page.getByRole("radio", { name: "History" }).click();
  const card = page.getByRole("heading", { name }).locator("../..");
  await expect(card).toContainText("streak 1");
  await expect(card).toContainText("longest 1");
});
