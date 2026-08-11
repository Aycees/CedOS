import { expect, test as setup, type Page } from "@playwright/test";

const AUTH_FILE = "tests/e2e/.auth/user.json";

export const E2E_EMAIL = "e2e@ced.local";
export const E2E_PASSWORD = "e2e-local-password";

/**
 * Signs the suite in once and reuses the session.
 *
 * Local Supabase has email confirmation disabled (supabase/config.toml), so a
 * sign-up lands straight in an authenticated session. Sign-up is attempted
 * first and falls back to sign-in when the account already exists, which keeps
 * the suite runnable repeatedly without resetting the database.
 */
setup("authenticate", async ({ page }) => {
  await page.goto("/sign-in");

  if (!(await submit(page, "sign-up"))) {
    await submit(page, "sign-in");
  }

  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});

async function submit(page: Page, mode: "sign-in" | "sign-up"): Promise<boolean> {
  const tab = mode === "sign-up" ? "Sign up" : "Sign in";
  const action = mode === "sign-up" ? "create account" : "sign in";

  /*
   * The tab click can land before React hydrates, in which case the handler
   * is not attached yet and the click is simply lost. Retrying until the
   * matching submit button appears is what makes this robust — a fixed wait
   * would be both slower and still occasionally wrong.
   */
  await expect(async () => {
    await page.getByRole("radio", { name: tab }).click();
    await expect(page.getByRole("button", { name: action })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 20_000 });

  await page.getByLabel("EMAIL").fill(E2E_EMAIL);
  await page.getByLabel("PASSWORD").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: action }).click();

  return page
    .waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
}
