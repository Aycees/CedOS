import { route } from "@/core/mutation/handler";
import { rewrapDekSchema } from "@/modules/vault/schema";
import { rewrapDek } from "@/modules/vault/service";

/**
 * Master-password change. Its own endpoint because it is a distinct verb
 * from setup — an O(1) rewrap of the DEK, never a re-encryption of items.
 */
export const PATCH = route(rewrapDekSchema, async ({ session, body }) => {
  await rewrapDek(session.userId, body);
});
