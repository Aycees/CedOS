import { readRoute, route } from "@/core/mutation/handler";
import {
  createBudgetSchema,
  deleteBudgetSchema,
  updateBudgetSchema,
} from "@/modules/finance/schema";
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
} from "@/modules/finance/service";

export const GET = readRoute(({ session, searchParams }) =>
  listBudgets(
    session.userId,
    searchParams.get("month") ?? new Date().toISOString().slice(0, 7),
  ),
);

export const POST = route(createBudgetSchema, async ({ session, body }) => {
  await createBudget(session.userId, body);
});

export const PATCH = route(updateBudgetSchema, async ({ session, body }) => {
  await updateBudget(session.userId, body);
});

export const DELETE = route(deleteBudgetSchema, async ({ session, body }) => {
  await deleteBudget(session.userId, body.id);
});
