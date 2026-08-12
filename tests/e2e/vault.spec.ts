import { expect, test, type Page } from "@playwright/test";

/**
 * Product spec §11 — Vault, at the UI level.
 *
 * The crypto itself (round-trip seal/open, wrong-password verifier failure,
 * recovery-kit unwrap, password-change rewrap) is covered exhaustively by
 * Vitest against the pure crypto layer (src/modules/vault/crypto/crypto.test.ts),
 * because testing Argon2id/AES-GCM through a browser would be slow and
 * imprecise (system design §8.3). What's left for here is the behaviour a
 * person can see — and the one non-negotiable a browser test can actually
 * check: that a network response never carries plaintext.
 *
 * Tests run in declared order against one shared account (config: workers 1,
 * fullyParallel false), so the vault set up in the first test is the vault
 * every later test unlocks. Each `page.goto` is a full reload, which resets
 * the module-scoped session — every test starts locked, matching "locked by
 * default on load".
 */

const MASTER_PASSWORD = "correct horse battery staple 42";

const unique = (label: string) => `${label} ${Date.now()}${Math.floor(Math.random() * 99)}`;

async function unlock(page: Page, password = MASTER_PASSWORD) {
  await page.getByLabel("Master password").fill(password);
  await page.getByRole("button", { name: "unlock" }).click();
}

test.describe.serial("Vault", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/vault");
  });

  test("setup creates the vault with a recovery kit, and it opens to a calm empty state", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Create a master password" })).toBeVisible();

    const continueButton = page.getByRole("button", { name: "continue" });
    await expect(continueButton).toBeDisabled();

    await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
    await page.getByLabel("Confirm master password").fill(MASTER_PASSWORD);
    await continueButton.click();

    await expect(page.getByRole("heading", { name: "Save this now" })).toBeVisible();
    const openButton = page.getByRole("button", { name: "open vault" });
    await expect(openButton).toBeDisabled();

    await page.getByRole("checkbox").check();
    await openButton.click();

    // Setup unlocks in place — no separate lock/unlock round trip needed.
    await expect(page.getByText("no credentials yet")).toBeVisible();
  });

  test("a wrong master password shows an error and clears the input; the right one unlocks", async ({
    page,
  }) => {
    await expect(page.getByLabel("Master password")).toBeVisible();

    await unlock(page, "not the right password");
    await expect(page.getByText("That password doesn't match.")).toBeVisible();
    await expect(page.getByLabel("Master password")).toHaveValue("");

    await unlock(page);
    await expect(page.getByText("no credentials yet")).toBeVisible();
  });

  test("two credentials for the same site are both allowed and persist", async ({ page }) => {
    await unlock(page);

    const site = unique("Gmail");

    for (const username of ["first@example.com", "second@example.com"]) {
      await page.getByRole("button", { name: "+ new credential" }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Site").fill(site);
      await dialog.getByLabel("Username").fill(username);
      await dialog.getByLabel("Password", { exact: true }).fill("hunter2");
      await dialog.getByRole("button", { name: "save" }).click();
      await expect(dialog).toBeHidden();
    }

    await expect(page.getByText("first@example.com")).toBeVisible();
    await expect(page.getByText("second@example.com")).toBeVisible();
  });

  test("deleting a credential requires a confirmation step", async ({ page }) => {
    await unlock(page);

    const site = unique("Throwaway Site");
    await page.getByRole("button", { name: "+ new credential" }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Site").fill(site);
    await dialog.getByRole("button", { name: "save" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: `Edit ${site}` }).click();
    dialog = page.getByRole("dialog");

    const deleteButton = dialog.getByRole("button", { name: "delete" });
    await deleteButton.click();
    // First click only arms the confirmation — the credential is still there.
    await expect(dialog.getByRole("button", { name: "confirm delete" })).toBeVisible();
    await expect(page.getByText(site)).toBeVisible();

    await dialog.getByRole("button", { name: "confirm delete" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(site)).toBeHidden();
  });

  test("the items API response never carries a plaintext password", async ({ page }) => {
    await unlock(page);

    const secret = `s3cr3t-${Date.now()}`;
    await page.getByRole("button", { name: "+ new credential" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Site").fill(unique("Bank"));
    await dialog.getByLabel("Password", { exact: true }).fill(secret);
    await dialog.getByRole("button", { name: "save" }).click();
    await expect(dialog).toBeHidden();

    const response = await page.request.get("/api/vault/items");
    const body = await response.text();
    expect(body).not.toContain(secret);
  });

  test("the JSON export never carries a plaintext password either (G2)", async ({ page }) => {
    await unlock(page);

    const secret = `xport-${Date.now()}`;
    await page.getByRole("button", { name: "+ new credential" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Site").fill(unique("Export Check"));
    await dialog.getByLabel("Password", { exact: true }).fill(secret);
    await dialog.getByRole("button", { name: "save" }).click();
    await expect(dialog).toBeHidden();

    const response = await page.request.get("/api/export");
    const body = await response.json();

    expect(body.vault.encrypted).toBe(true);
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  test("auto-lock mid-edit discards the draft and returns to the lock screen", async ({
    page,
  }) => {
    await unlock(page);

    // Shrink the idle window well below the UI's minimum (1 min) so the
    // test doesn't wait a full minute — the duration itself is exercised
    // through the security panel's own control elsewhere. The running page
    // cached the old settings on unlock, so a reload (and a second unlock)
    // is what picks the new value up.
    await page.request.patch("/api/vault/settings/preferences", {
      data: { unlockMethod: "MASTER_PASSWORD", autoLockSeconds: 3 },
    });
    await page.reload();
    await unlock(page);

    await page.getByRole("button", { name: "+ new credential" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Site").fill(unique("Should not be saved"));

    await page.waitForTimeout(5000);

    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Master password")).toBeVisible();
  });
});
