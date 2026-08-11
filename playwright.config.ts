import { defineConfig, devices } from "@playwright/test";

/**
 * System design §8.3: "Every edge case in the product spec §3–§12 becomes one
 * Playwright test... they are the actual definition of done."
 *
 * This branch covers the edge cases for the modules it builds — Tasks (§5) and
 * Journal (§7). The remaining ~40 land with their phases.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // single-user app against one dev database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    // The stored session lives on the chromium project, not globally: the
    // setup project is what creates that file, so it cannot require it.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
