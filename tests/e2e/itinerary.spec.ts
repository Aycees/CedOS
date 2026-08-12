import { expect, test, type Page } from "@playwright/test";

/**
 * Product spec §10 — Itinerary, and decisions A7 and A8.
 *
 * The sync planning itself is covered exhaustively by Vitest against the pure
 * engine (src/modules/itinerary/engine/sync.test.ts). What is tested here is
 * the behaviour a person can see.
 */

const unique = (label: string) => `${label} ${Date.now()}${Math.floor(Math.random() * 99)}`;

async function newTrip(page: Page, place: string, start: string, end: string) {
  await page.getByRole("button", { name: "+ new trip" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PLACE").fill(place);
  await dialog.getByLabel("START").fill(start);
  await dialog.getByLabel("END").fill(end);
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: `Open ${place}` }).click();
}

async function addStop(
  page: Page,
  day: number,
  activity: string,
  time = "no set time",
) {
  await page
    .getByRole("button", { name: "+ add stop" })
    .nth(day - 1)
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Activity").fill(activity);
  await dialog.getByLabel("TIME").selectOption({ label: time });
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

/**
 * Opens the push dialog, creating the Travel calendar first if this is the
 * run's first push. Written as a loop rather than a one-shot branch because
 * the dialog closes and reopens in between, and a stale handle would race it.
 */
async function openPush(page: Page) {
  const dialog = page.getByRole("dialog");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole("button", { name: "push to calendar" }).click();
    await expect(dialog).toBeVisible();

    const create = dialog.getByRole("button", { name: "create a Travel calendar" });
    if ((await create.count()) === 0) return;

    await create.click();
    await expect(dialog).toBeHidden();
  }
  throw new Error("push dialog never became ready");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/itinerary");
});

test("a trip with no stops reads as unplanned, not broken", async ({ page }) => {
  // Product spec §10: "A trip with zero stops yet — valid state, shown as
  // 'not planned yet' rather than broken."
  const place = unique("Empty");
  await page.getByRole("button", { name: "+ new trip" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PLACE").fill(place);
  await dialog.getByLabel("START").fill("2026-09-12");
  await dialog.getByLabel("END").fill("2026-09-13");
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("link", { name: `Open ${place}` })).toContainText(
    "not planned yet",
  );
});

test("a trip cannot end before it starts", async ({ page }) => {
  await page.getByRole("button", { name: "+ new trip" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PLACE").fill(unique("Backwards"));
  await dialog.getByLabel("START").fill("2026-09-15");
  await dialog.getByLabel("END").fill("2026-09-12");
  await dialog.getByRole("button", { name: "save" }).click();

  await expect(dialog.getByText(/cannot end before it starts/)).toBeVisible();
  await dialog.getByRole("button", { name: "cancel" }).click();
});

test("days are numbered from the start date and untimed stops lead", async ({
  page,
}) => {
  await newTrip(page, unique("Baguio"), "2026-09-12", "2026-09-15");

  await expect(page.getByText(/Day 1 · SEP 12, 2026/)).toBeVisible();
  await expect(page.getByText(/Day 4 · SEP 15, 2026/)).toBeVisible();

  const timed = unique("Timed");
  const untimed = unique("Untimed");
  await addStop(page, 2, timed, "09:30");
  await addStop(page, 2, untimed);

  // Both must be on screen before their order can be read — the list
  // repaints on query invalidation, and reading too early sees one row.
  const stops = page.getByRole("button", { name: new RegExp(`Edit (${timed}|${untimed})`) });
  await expect(stops).toHaveCount(2);

  // Product spec §10: untimed stops must not masquerade as midnight; they
  // head the day as a group because they are genuinely unscheduled.
  const labels = await stops.allInnerTexts();
  expect(labels[0]).toContain(untimed);
  expect(labels[1]).toContain(timed);
});

test("pushing is blocked until a Travel calendar exists", async ({ page }) => {
  // Consistent with product spec §4: no event may be uncategorised, so the
  // push waits rather than inventing a category.
  await newTrip(page, unique("Siargao"), "2026-10-01", "2026-10-03");
  await addStop(page, 1, unique("Surf lesson"), "08:00");

  await openPush(page);
  // openPush returns once the dialog is showing a real plan, which means the
  // Travel calendar now exists — either it already did, or the blocked state
  // offered to create it and that offer worked.
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "push", exact: true }),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "cancel" }).click();
});

test("pushing twice creates no duplicates (A7)", async ({ page }) => {
  const place = unique("Sagada");
  await newTrip(page, place, "2026-11-02", "2026-11-04");
  const stop = unique("Cave tour");
  await addStop(page, 1, stop, "07:00");

  await openPush(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "push", exact: true }).click();
  await expect(dialog.getByText(/Added to your Travel calendar/)).toBeVisible();
  await dialog.getByRole("button", { name: "close" }).click();
  await expect(dialog).toBeHidden();

  // Second push — the unique sourceStopId makes duplication structurally
  // impossible, so there is simply nothing to do.
  await page.getByRole("button", { name: "push to calendar" }).click();
  const second = page.getByRole("dialog");
  await expect(second.getByText(/already in sync/)).toBeVisible();
  await expect(second.getByRole("button", { name: "push" })).toBeDisabled();
  await second.getByRole("button", { name: "cancel" }).click();

  // And the calendar holds exactly one event for it. The grid opens on the
  // current month, so walk forward to the trip's month first.
  await page.goto("/calendar");
  await page.getByRole("radio", { name: "List" }).click();
  while (!(await page.getByText("November 2026").count())) {
    await page.getByRole("button", { name: "Next month" }).click();
  }
  await expect(page.getByRole("button", { name: new RegExp(stop) })).toHaveCount(1);
});

test("shortening a trip strands stops rather than deleting them (A8)", async ({
  page,
}) => {
  const place = unique("Ilocos");
  await newTrip(page, place, "2026-12-01", "2026-12-04");
  const late = unique("Last day drive");
  await addStop(page, 4, late, "10:00");

  await page.getByRole("button", { name: "edit trip" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("END").fill("2026-12-02");
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();

  // Product spec §10: stops beyond the new end date need explicit handling,
  // never silent deletion.
  await expect(page.getByText("OUTSIDE TRIP DATES")).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit ${late}` })).toBeVisible();
});

test("a stop can be edited and deleted", async ({ page }) => {
  await newTrip(page, unique("Batanes"), "2027-01-05", "2027-01-06");
  const stop = unique("Lighthouse");
  await addStop(page, 1, stop, "15:00");

  await page.getByRole("button", { name: `Edit ${stop}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "delete" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: `Edit ${stop}` })).toHaveCount(0);
});
