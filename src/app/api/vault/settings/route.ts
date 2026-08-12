import { readRoute, route } from "@/core/mutation/handler";
import { initVaultSchema } from "@/modules/vault/schema";
import { getSettings, initVault } from "@/modules/vault/service";

/**
 * Ciphertext and metadata only (system design §4.4) — `null` here means
 * "no vault yet", which the client renders as the setup screen rather than
 * an error.
 */
export const GET = readRoute(async ({ session }) => {
  return getSettings(session.userId);
});

export const POST = route(initVaultSchema, async ({ session, body }) => {
  await initVault(session.userId, body);
});
