import { readRoute, route } from "@/core/mutation/handler";
import {
  createAccountSchema,
  deleteAccountSchema,
  updateAccountSchema,
} from "@/modules/finance/schema";
import {
  createAccount,
  deleteAccount,
  getAccountImpact,
  listAccounts,
  updateAccount,
} from "@/modules/finance/service";

export const GET = readRoute(async ({ session, searchParams }) => {
  const impactFor = searchParams.get("impactFor");
  if (impactFor) return getAccountImpact(session.userId, impactFor);
  return listAccounts(session.userId);
});

export const POST = route(createAccountSchema, async ({ session, body }) => {
  await createAccount(session.userId, body);
});

export const PATCH = route(updateAccountSchema, async ({ session, body }) => {
  await updateAccount(session.userId, body);
});

export const DELETE = route(deleteAccountSchema, ({ session, body }) =>
  deleteAccount(session.userId, body),
);
