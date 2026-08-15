import { route } from "@/core/mutation/handler";
import {
  createBudgetGroupSchema,
  deleteBudgetGroupSchema,
  updateBudgetGroupSchema,
} from "@/modules/finance/schema";
import {
  createBudgetGroup,
  deleteBudgetGroup,
  updateBudgetGroup,
} from "@/modules/finance/service";

export const POST = route(createBudgetGroupSchema, async ({ session, body }) => {
  await createBudgetGroup(session.userId, body);
});

export const PATCH = route(updateBudgetGroupSchema, async ({ session, body }) => {
  await updateBudgetGroup(session.userId, body.id, body.name);
});

export const DELETE = route(deleteBudgetGroupSchema, async ({ session, body }) => {
  await deleteBudgetGroup(session.userId, body.id);
});
