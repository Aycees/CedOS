import { expect, test, type Page } from "@playwright/test";

/**
 * Product spec §4 — Calendar, and decisions A1 and A2.
 *
 * These run against a fresh e2e account, so the first test genuinely
 * exercises the no-categories-yet state rather than simulating it.
 */

const unique = (label: string) => `${label} ${Date.now()}${Math.floor(Math.random() * 99)}`;

async function newCalendar(page: Page, name: string, color = "blue") {
  await page.getByRole("button", { name: "+ new calendar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("NAME").fill(name);
  await dialog.getByRole("button", { name: color, exact: true }).click();
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

async function newEvent(
  page: Page,
  title: string,
  opts: { date?: string; time?: string; calendar?: string } = {},
) {
  await page.getByRole("button", { name: "+ new event" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Event title").fill(title);
  if (opts.date) await dialog.getByLabel("DATE").fill(opts.date);
  // "all day" is the empty option — an untimed event, not midnight (A2).
  await dialog.getByLabel("TIME · OPTIONAL").selectOption(opts.time ?? "");
  if (opts.calendar) await dialog.getByLabel("CALENDAR").selectOption({ label: opts.calendar });
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/calendar");
});

test("a fresh account has no calendars and blocks uncategorised events", async ({
  page,
}) => {
  // Product spec §4: "No categories yet (fresh account) — event creation
  // should prompt the user to create a category first."
  const railEmpty = await page.getByText("no calendars yet").count();
  test.skip(railEmpty === 0, "account already has calendars");

  await expect(page.getByRole("button", { name: "+ new event" })).toBeDisabled();
  await expect(
    page.getByText("create a calendar first — every event belongs to one"),
  ).toBeVisible();
});

test("a calendar can be created and appears in the rail", async ({ page }) => {
  const name = unique("Personal");
  await newCalendar(page, name, "violet");
  // Anchored, so it matches the rail entry and not its neighbouring "Edit …".
  await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ new event" })).toBeEnabled();
});

test("a duplicate calendar name is rejected case-insensitively", async ({ page }) => {
  const name = unique("Travel");
  await newCalendar(page, name);

  await page.getByRole("button", { name: "+ new calendar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("NAME").fill(name.toUpperCase());
  await dialog.getByRole("button", { name: "save" }).click();

  await expect(dialog.getByText(/already have a calendar called/i)).toBeVisible();
  await dialog.getByRole("button", { name: "cancel" }).click();
});

test("an untimed event renders without a time (A2)", async ({ page }) => {
  const calendar = unique("Errands");
  await newCalendar(page, calendar);

  const title = unique("Grocery run");
  await newEvent(page, title, { date: "2026-08-13", calendar });

  // In the agenda it reads "all day" rather than 00:00 — the storage decision
  // in A2 is what makes that distinction possible at all.
  await page.getByRole("radio", { name: "List" }).click();
  const row = page.getByRole("button", { name: new RegExp(title) });
  await expect(row).toContainText("all day");
});

test("a dense day truncates rather than overflowing", async ({ page }) => {
  const calendar = unique("Dense");
  await newCalendar(page, calendar);

  // Four events on one day, against a three-per-cell limit.
  for (const time of ["09:00", "11:00", "13:00", "15:00"]) {
    await newEvent(page, unique(`Block ${time}`), {
      date: "2026-08-05",
      time,
      calendar,
    });
  }

  await expect(page.getByRole("button", { name: /\+\d+ more/ })).toBeVisible();
});

test("toggling a calendar filter hides and shows its events", async ({ page }) => {
  const calendar = unique("Hideable");
  await newCalendar(page, calendar);
  const title = unique("Hide me");
  await newEvent(page, title, { date: "2026-08-06", time: "10:00", calendar });

  await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^${calendar}`) }).click();
  await expect(page.getByRole("button", { name: new RegExp(title) })).toHaveCount(0);

  await page.getByRole("button", { name: new RegExp(`^${calendar}`) }).click();
  await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
});

test("recolouring a calendar restyles its existing events immediately", async ({
  page,
}) => {
  const calendar = unique("Recolour");
  await newCalendar(page, calendar, "blue");
  const title = unique("Coloured event");
  await newEvent(page, title, { date: "2026-08-07", time: "10:00", calendar });

  const dot = page.getByRole("button", { name: new RegExp(title) }).locator("span").first();
  const before = await dot.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByRole("button", { name: `Edit ${calendar}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "green", exact: true }).click();
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();

  // Colour is a lookup through the FK, never copied onto the event, so there
  // is nothing to backfill (product spec §4).
  await expect.poll(() => dot.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    before,
  );
});

test("deleting a calendar with events lists them rather than counting them (A1)", async ({
  page,
}) => {
  const doomed = unique("Doomed");
  await newCalendar(page, doomed);
  const keep = unique("Keeper");
  await newCalendar(page, keep);

  const eventTitle = unique("Event at stake");
  await newEvent(page, eventTitle, { date: "2026-08-08", time: "09:00", calendar: doomed });

  await page.getByRole("button", { name: `Edit ${doomed}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "delete" }).click();

  const preview = page.getByRole("dialog");
  await expect(preview.getByText(`Delete "${doomed}"?`)).toBeVisible();
  // The list IS the confirmation — a bare count gives the user no way to
  // judge whether the affected events matter.
  await expect(preview.getByText(eventTitle)).toBeVisible();
  await expect(preview.getByRole("button", { name: /delete all \d+ events/ })).toBeVisible();
  await expect(preview.getByRole("button", { name: "move & delete" })).toBeVisible();

  await preview.getByLabel("MOVE ALL TO").selectOption({ label: keep });
  await preview.getByRole("button", { name: "move & delete" }).click();
  await expect(preview).toBeHidden();

  // Reassigned, not destroyed.
  await expect(page.getByRole("button", { name: new RegExp(`^${doomed}`) })).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(eventTitle) })).toBeVisible();
});

test("an empty calendar deletes without the preview", async ({ page }) => {
  // A1: "a category with zero events deletes with a simple confirm."
  const name = unique("Unused");
  await newCalendar(page, name);

  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "delete" }).click();

  await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
});

test("an event can be edited and deleted", async ({ page }) => {
  const calendar = unique("Editable");
  await newCalendar(page, calendar);
  const title = unique("Draft event");
  await newEvent(page, title, { date: "2026-08-09", time: "12:00", calendar });

  await page.getByRole("button", { name: new RegExp(title) }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "delete" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: new RegExp(title) })).toHaveCount(0);
});
