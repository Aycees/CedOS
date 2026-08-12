import { readRoute, route } from "@/core/mutation/handler";
import {
  createTransactionSchema,
  deleteTransactionSchema,
  updateTransactionSchema,
} from "@/modules/finance/schema";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from "@/modules/finance/service";

export const GET = readRoute(({ session, searchParams }) =>
  listTransactions(session.userId, {
    query: searchParams.get("q") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    month: searchParams.get("month") ?? undefined,
  }),
);

export const POST = route(createTransactionSchema, async ({ session, body }) => {
  await createTransaction(session.userId, body);
});

export const PATCH = route(updateTransactionSchema, async ({ session, body }) => {
  await updateTransaction(session.userId, body);
});

export const DELETE = route(deleteTransactionSchema, async ({ session, body }) => {
  await deleteTransaction(session.userId, body.id);
});
