import { route } from "@/core/mutation/handler";
import { vaultPreferencesSchema } from "@/modules/vault/schema";
import { updatePreferences } from "@/modules/vault/service";

/** Metadata only — unlock method, lock-on-load, auto-lock duration. No key material. */
export const PATCH = route(vaultPreferencesSchema, async ({ session, body }) => {
  await updatePreferences(session.userId, body);
});
