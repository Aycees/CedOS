import { readRoute, route } from "@/core/mutation/handler";
import { createBudgetSchema, deleteBudgetSchema } from "@/modules/finance/schema";
import { createBudget, deleteBudget, listBudgets } from "@/modules/finance/service";

export const GET = readRoute(({ session, searchParams }) =>
  listBudgets(
    session.userId,
    searchParams.get("month") ?? new Date().toISOString().slice(0, 7),
  ),
);

export const POST = route(createBudgetSchema, async ({ session, body }) => {
  await createBudget(session.userId, body);
});

export const DELETE = route(deleteBudgetSchema, async ({ session, body }) => {
  await deleteBudget(session.userId, body.id);
});
