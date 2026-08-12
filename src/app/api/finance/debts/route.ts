import { readRoute, route } from "@/core/mutation/handler";
import {
  createDebtSchema,
  deleteDebtSchema,
  settleDebtSchema,
} from "@/modules/finance/schema";
import {
  createDebt,
  deleteDebt,
  listDebts,
  settleDebt,
} from "@/modules/finance/service";

export const GET = readRoute(({ session }) => listDebts(session.userId));

export const POST = route(createDebtSchema, async ({ session, body }) => {
  await createDebt(session.userId, body);
});

/** Settling is reversible, so this takes a boolean rather than being one-way. */
export const PATCH = route(settleDebtSchema, async ({ session, body }) => {
  await settleDebt(session.userId, body.id, body.settled);
});

export const DELETE = route(deleteDebtSchema, async ({ session, body }) => {
  await deleteDebt(session.userId, body.id);
});
