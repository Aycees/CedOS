import { readRoute, route } from "@/core/mutation/handler";
import {
  createCategorySchema,
  deleteCategorySchema,
  updateCategorySchema,
} from "@/modules/calendar/schema";
import {
  createCategory,
  deleteCategory,
  getCategoryImpact,
  listCategories,
  updateCategory,
} from "@/modules/calendar/service";

export const GET = readRoute(async ({ session, searchParams }) => {
  // A1: the impact preview asks for the affected events before offering the
  // two exits, so the user sees what is at stake rather than a bare count.
  const impactFor = searchParams.get("impactFor");
  if (impactFor) {
    return getCategoryImpact(session.userId, impactFor);
  }
  return listCategories(session.userId);
});

export const POST = route(createCategorySchema, async ({ session, body }) => {
  await createCategory(session.userId, body);
});

export const PATCH = route(updateCategorySchema, async ({ session, body }) => {
  await updateCategory(session.userId, body);
});

export const DELETE = route(deleteCategorySchema, ({ session, body }) =>
  deleteCategory(session.userId, body),
);
