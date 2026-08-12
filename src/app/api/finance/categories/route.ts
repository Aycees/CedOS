import { readRoute, route } from "@/core/mutation/handler";
import {
  createCategorySchema,
  deleteCategorySchema,
  updateCategorySchema,
} from "@/modules/finance/schema";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/modules/finance/service";

export const GET = readRoute(({ session }) => listCategories(session.userId));

export const POST = route(createCategorySchema, async ({ session, body }) => {
  await createCategory(session.userId, body);
});

export const PATCH = route(updateCategorySchema, async ({ session, body }) => {
  await updateCategory(session.userId, body);
});

export const DELETE = route(deleteCategorySchema, async ({ session, body }) => {
  await deleteCategory(session.userId, body.id);
});
