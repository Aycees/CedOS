import { route } from "@/core/mutation/handler";
import { createTransferSchema } from "@/modules/finance/schema";
import { createTransfer } from "@/modules/finance/service";

/**
 * G1: one intent in, two paired rows out, written in a single database
 * transaction so a half-logged transfer cannot exist.
 */
export const POST = route(createTransferSchema, async ({ session, body }) => {
  await createTransfer(session.userId, body);
});
