import { expect, test, type Page } from "@playwright/test";

/**
 * Product spec §9 — Money, and decision G1.
 */

const unique = (label: string) => `${label} ${Date.now()}${Math.floor(Math.random() * 99)}`;

async function newAccount(page: Page, name: string, opening = "1000") {
  await page.getByRole("button", { name: "+ account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("NAME").fill(name);
  await dialog.getByLabel("OPENING BALANCE").fill(opening);
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

async function newTransaction(
  page: Page,
  name: string,
  amount: string,
  opts: { account?: string; kind?: "Expense" | "Income" } = {},
) {
  await page.getByRole("button", { name: "+ transaction" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: opts.kind ?? "Expense" }).click();
  await dialog.getByLabel("NAME").fill(name);
  await dialog.getByLabel("AMOUNT").fill(amount);
  // Always explicit: the modal defaults to the first account, which is not
  // necessarily the one this test just created.
  if (opts.account) {
    await dialog.getByLabel("Account", { exact: true }).selectOption({ label: opts.account });
  }
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/finance");
});

test("transactions are blocked until an account exists", async ({ page }) => {
  const hasAccounts = await page.getByRole("button", { name: /^Edit / }).count();
  test.skip(hasAccounts > 0, "account already exists");

  await expect(page.getByRole("button", { name: "+ transaction" })).toBeDisabled();
  await expect(page.getByText(/add an account first/)).toBeVisible();
});

test("an account's balance is derived from its transactions", async ({ page }) => {
  const name = unique("Wallet");
  await newAccount(page, name, "1000");
  await newTransaction(page, unique("Groceries"), "250", { account: name });

  // 1000 opening − 250 expense. Balances are computed, never stored, so this
  // is the aggregate rather than a running total that could drift.
  await expect(page.getByRole("button", { name: `Edit ${name}` })).toContainText("₱750");
});

test("a duplicate account name is rejected case-insensitively", async ({ page }) => {
  const name = unique("Savings");
  await newAccount(page, name);

  await page.getByRole("button", { name: "+ account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("NAME").fill(name.toUpperCase());
  await dialog.getByRole("button", { name: "save" }).click();

  await expect(dialog.getByText(/already have an account called/i)).toBeVisible();
  await dialog.getByRole("button", { name: "cancel" }).click();
});

test("an overdrawn account reads as a warning, not a bare negative", async ({ page }) => {
  const name = unique("Thin");
  await newAccount(page, name, "100");
  await newTransaction(page, unique("Big spend"), "500", { account: name });

  const tile = page.getByRole("button", { name: `Edit ${name}` });
  await expect(tile).toContainText("−₱400");
  // Product spec §9 asks for a visual distinction, not just a minus sign.
  const colour = await tile.locator("span").last().evaluate(
    (el) => getComputedStyle(el).color,
  );
  expect(colour).toBe("rgb(178, 69, 58)"); // --accent-red
});

test("a transfer is stored as two rows but reads as one movement (G1)", async ({
  page,
}) => {
  const from = unique("From");
  const to = unique("To");
  await newAccount(page, from, "5000");
  await newAccount(page, to, "0");

  await page.getByRole("button", { name: "+ transaction" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Transfer" }).click();
  await dialog.getByLabel("NAME").fill("Top up");
  await dialog.getByLabel("AMOUNT").fill("2000");
  await dialog.getByLabel("Transfer from").selectOption({ label: from });
  await dialog.getByLabel("Transfer to").selectOption({ label: to });
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();

  // Both balances moved…
  await expect(page.getByRole("button", { name: `Edit ${from}` })).toContainText("₱3,000");
  await expect(page.getByRole("button", { name: `Edit ${to}` })).toContainText("₱2,000");

  // …and the two rows are presented as a single row reading From → To.
  const row = page.getByRole("button", { name: "Edit Top up" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`${from} → ${to}`);
});

test("a transfer is excluded from the month's spending", async ({ page }) => {
  const from = unique("Source");
  const to = unique("Target");
  await newAccount(page, from, "5000");
  await newAccount(page, to, "0");

  /*
   * Asserted as a delta rather than an absolute: other tests in this file
   * have already spent money this month. The claim under test is that a
   * transfer moves the figure by nothing at all — moving money between your
   * own accounts is not spending, and counting it would double-count against
   * every budget (G1).
   */
  // The spend figure only renders against an allowance, so set one.
  await page.getByRole("button", { name: /allowance/ }).first().click();
  const incomeDialog = page.getByRole("dialog");
  await incomeDialog.getByLabel("AMOUNT A MONTH").fill("9000");
  await incomeDialog.getByRole("button", { name: "save" }).click();
  await expect(incomeDialog).toBeHidden();

  const spentLine = page.getByText(/^spent /);
  const before = await spentLine.innerText();

  await page.getByRole("button", { name: "+ transaction" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Transfer" }).click();
  await dialog.getByLabel("AMOUNT").fill("1000");
  await dialog.getByLabel("Transfer from").selectOption({ label: from });
  await dialog.getByLabel("Transfer to").selectOption({ label: to });
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();

  // The balances did move, so the transfer definitely happened…
  await expect(page.getByRole("button", { name: `Edit ${to}` })).toContainText("₱1,000");
  // …and spending did not.
  await expect(spentLine).toHaveText(before);
});

test("deleting an account with transactions lists them before deciding", async ({
  page,
}) => {
  const doomed = unique("Doomed");
  const keeper = unique("Keeper");
  await newAccount(page, keeper, "500");
  await newAccount(page, doomed, "500");

  const txName = unique("At stake");
  await page.getByRole("button", { name: "+ transaction" }).click();
  const txDialog = page.getByRole("dialog");
  await txDialog.getByLabel("NAME").fill(txName);
  await txDialog.getByLabel("AMOUNT").fill("100");
  await txDialog.getByLabel("Account", { exact: true }).selectOption({ label: doomed });
  await txDialog.getByRole("button", { name: "save" }).click();
  await expect(txDialog).toBeHidden();

  await page.getByRole("button", { name: `Edit ${doomed}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "delete" }).click();

  // Never silently orphan transaction history (product spec §9).
  const preview = page.getByRole("dialog");
  await expect(preview.getByText(`Delete "${doomed}"?`)).toBeVisible();
  await expect(preview.getByText(txName)).toBeVisible();

  await preview.getByLabel("MOVE ALL TO").selectOption({ label: keeper });
  await preview.getByRole("button", { name: "move & delete" }).click();
  await expect(preview).toBeHidden();

  await expect(page.getByRole("button", { name: `Edit ${doomed}` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Edit ${txName}` })).toBeVisible();
});

test("settling a debt is reversible", async ({ page }) => {
  await page.getByRole("radio", { name: "Debts" }).click();
  const person = unique("Rina");

  await page.getByRole("button", { name: "+ new debt" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PERSON").fill(person);
  await dialog.getByLabel("AMOUNT").fill("500");
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("checkbox", { name: `Settle ${person}` }).click();
  await expect(page.getByRole("checkbox", { name: `Unsettle ${person}` })).toBeVisible();

  // settledAt is a nullable timestamp rather than a boolean precisely so a
  // mis-click is trivially undone (product spec §9).
  await page.getByRole("checkbox", { name: `Unsettle ${person}` }).click();
  await expect(page.getByRole("checkbox", { name: `Settle ${person}` })).toBeVisible();
});

test("a budget group aggregates its members and survives collapsing", async ({
  page,
}) => {
  const category = unique("Food");
  await page.getByRole("radio", { name: "Transactions" }).click();
  await page.getByRole("button", { name: "+ category" }).click();
  const catDialog = page.getByRole("dialog");
  await catDialog.getByLabel("NAME").fill(category);
  await catDialog.getByRole("button", { name: "save" }).click();
  await expect(catDialog).toBeHidden();

  const groupName = unique("Trip");
  await page.getByRole("radio", { name: "Budget" }).click();
  page.once("dialog", (d) => d.accept(groupName));
  await page.getByRole("button", { name: "+ new group" }).click();

  await page.getByRole("button", { name: "+ new budget" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("CATEGORY").selectOption({ label: category });
  await dialog.getByLabel("MONTHLY CAP").fill("4000");
  await dialog.getByLabel("GROUP · OPTIONAL").selectOption({ label: groupName });
  await dialog.getByRole("button", { name: "save" }).click();
  await expect(dialog).toBeHidden();

  const group = page.getByRole("button", { name: new RegExp(groupName) });
  await expect(group).toContainText("of ₱4,000");

  // Collapsing hides the members but must not lose or desync the total.
  await group.click();
  await expect(page.getByText(category, { exact: true })).toHaveCount(0);
  await expect(group).toContainText("of ₱4,000");
});
