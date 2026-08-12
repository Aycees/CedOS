import { route } from "@/core/mutation/handler";
import { recordAuditSchema } from "@/modules/vault/schema";
import { recordAudit } from "@/modules/vault/service";

/**
 * Client-driven (see service.ts): unlock success/failure and item-revealed
 * events happen entirely in the browser, so the client reports them here
 * rather than the server inferring them from other calls.
 */
export const POST = route(recordAuditSchema, async ({ session, body }) => {
  await recordAudit(session.userId, body);
});
