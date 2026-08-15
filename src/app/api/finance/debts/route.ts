import { readRoute, route } from "@/core/mutation/handler";
import {
  createDebtSchema,
  deleteDebtSchema,
  updateDebtSchema,
} from "@/modules/finance/schema";
import {
  createDebt,
  deleteDebt,
  listDebts,
  updateDebt,
} from "@/modules/finance/service";

export const GET = readRoute(({ session }) => listDebts(session.userId));

export const POST = route(createDebtSchema, async ({ session, body }) => {
  await createDebt(session.userId, body);
});

export const PATCH = route(updateDebtSchema, async ({ session, body }) => {
  await updateDebt(session.userId, body);
});

export const DELETE = route(deleteDebtSchema, async ({ session, body }) => {
  await deleteDebt(session.userId, body.id);
});
