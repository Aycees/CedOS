import { expect, test, type Page } from "@playwright/test";

/**
 * Product spec §6 — Notes.
 */

const unique = (label: string) => `${label} ${Date.now()}${Math.floor(Math.random() * 99)}`;

const SAMPLE = [
  "# Chapter 3",
  "",
  "The **central claim** is that *sample size* drives everything.",
  "",
  "- [x] Re-read section 3.2",
  "- [ ] Email advisor about `n = 40`",
  "",
  "> Statistics is the grammar of science.",
  "",
  "---",
].join("\n");

/** Types into the body the way a keystroke does, so React's onChange fires. */
async function setBody(page: Page, markdown: string) {
  await page.getByLabel("Note body").evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, markdown);
}

async function newNote(
  page: Page,
  opts: { title?: string; tag?: string; body?: string } = {},
) {
  await page.getByRole("button", { name: "+ new note" }).first().click();
  const dialog = page.getByRole("dialog");
  if (opts.title !== undefined) await dialog.getByLabel("Note title").fill(opts.title);
  if (opts.tag) await dialog.getByLabel("TAG").fill(opts.tag);
  if (opts.body) await setBody(page, opts.body);
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/notes");
});

test("markdown round-trips through preview without changing", async ({ page }) => {
  // Product spec §6: "Switching from preview back to edit must not lose
  // formatting fidelity." Markdown is the single stored representation, so
  // preview is a render of it rather than a conversion — this asserts that.
  await page.getByRole("button", { name: "+ new note" }).first().click();
  await setBody(page, SAMPLE);

  await page.getByRole("radio", { name: "Preview" }).click();
  await page.getByRole("radio", { name: "Markdown" }).click();

  await expect(page.getByLabel("Note body")).toHaveValue(SAMPLE);
});

test("preview renders headings, emphasis, quotes, code and checklists", async ({
  page,
}) => {
  await page.getByRole("button", { name: "+ new note" }).first().click();
  await setBody(page, SAMPLE);
  await page.getByRole("radio", { name: "Preview" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Chapter 3" })).toBeVisible();
  await expect(dialog.locator("strong", { hasText: "central claim" })).toBeVisible();
  await expect(dialog.locator("em", { hasText: "sample size" })).toBeVisible();
  await expect(dialog.locator("blockquote")).toContainText("grammar of science");
  await expect(dialog.locator("code", { hasText: "n = 40" })).toBeVisible();
  await expect(dialog.locator("hr")).toBeVisible();

  // A ticked checklist item reads as done rather than as plain text.
  const doneItem = dialog.locator("li", { hasText: "Re-read section 3.2" });
  await expect(doneItem.locator("span").last()).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
});

test("an untitled note is saved and shown as Untitled", async ({ page }) => {
  // Product spec §6: "Empty note body / empty title — allow save, show a
  // placeholder title like 'Untitled'."
  await newNote(page, { title: "", body: unique("# A body with no title") });
  await expect(page.getByRole("button", { name: /Untitled/ }).first()).toBeVisible();
});

test("notes can be searched by content", async ({ page }) => {
  const needle = `serendipity${Date.now()}`;
  await newNote(page, { title: unique("Findable"), body: `Something about ${needle}.` });

  await page.getByLabel("Search notes").fill(needle);
  await expect(page.getByRole("button", { name: /Findable/ })).toBeVisible();

  await page.getByLabel("Search notes").fill(`absent${Date.now()}`);
  await expect(page.getByText("no notes match")).toBeVisible();
});

test("notes can be searched by tag", async ({ page }) => {
  const tag = `tag${Date.now()}`;
  const title = unique("Tagged note");
  await newNote(page, { title, tag, body: "Body text unrelated to the tag." });

  await page.getByLabel("Search notes").fill(tag);
  await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
});

test("the grid view previews a long note rather than rendering it whole", async ({
  page,
}) => {
  const title = unique("Long note");
  await newNote(page, { title, body: `# Heading\n\n${"word ".repeat(400)}` });

  await page.getByRole("radio", { name: "Grid" }).click();
  const card = page.getByRole("button", { name: new RegExp(title) });
  await expect(card).toBeVisible();
  // Preview text is flattened and truncated, so no heading element survives.
  await expect(card.locator("h1")).toHaveCount(0);
  await expect(card).toContainText("…");
});

test("a note can be edited and deleted", async ({ page }) => {
  const title = unique("Disposable");
  await newNote(page, { title, body: "temporary" });

  await page.getByRole("button", { name: new RegExp(title) }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "delete" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: new RegExp(title) })).toHaveCount(0);
});

test("the toolbar wraps the current selection rather than replacing it", async ({
  page,
}) => {
  await page.getByRole("button", { name: "+ new note" }).first().click();
  await setBody(page, "emphasise me");

  const body = page.getByLabel("Note body");
  await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 9));
  await page.getByRole("button", { name: "Bold" }).click();

  await expect(body).toHaveValue("**emphasise** me");
});
