import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests cover the pure logic — dates, money, the error contract.
 *
 * System design §8.3 puts the product spec's edge cases in Playwright and the
 * pure functions here, because testing date arithmetic through a browser is
 * slow and imprecise. The habit cadence engine (phase 5) is the main
 * beneficiary of that split; these are its foundations.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
