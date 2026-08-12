import { route } from "@/core/mutation/handler";
import {
  createBudgetGroupSchema,
  deleteBudgetGroupSchema,
} from "@/modules/finance/schema";
import { createBudgetGroup, deleteBudgetGroup } from "@/modules/finance/service";

export const POST = route(createBudgetGroupSchema, async ({ session, body }) => {
  await createBudgetGroup(session.userId, body);
});

export const DELETE = route(deleteBudgetGroupSchema, async ({ session, body }) => {
  await deleteBudgetGroup(session.userId, body.id);
});
