/**
 * The e2e account's identity — shared between auth.setup.ts and any spec
 * that needs to reset the account mid-suite (e.g. home.spec.ts). Not itself
 * a test file, so other spec files may import it: Playwright forbids a spec
 * importing another spec file directly.
 */
export const E2E_EMAIL = "e2e@ced.local";
export const E2E_PASSWORD = "e2e-local-password";
