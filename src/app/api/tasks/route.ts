import { route, readRoute } from "@/core/mutation/handler";
import {
  createTaskSchema,
  deleteTaskSchema,
  updateTaskSchema,
} from "@/modules/tasks/schema";
import {
  createTask,
  deleteTask,
  listBuckets,
  updateTask,
} from "@/modules/tasks/service";

export const GET = readRoute(({ session }) =>
  listBuckets(session.userId, session.timezone),
);

export const POST = route(createTaskSchema, async ({ session, body }) => {
  await createTask(session.userId, body);
});

export const PATCH = route(updateTaskSchema, async ({ session, body }) => {
  await updateTask(session.userId, body);
});

export const DELETE = route(deleteTaskSchema, async ({ session, body }) => {
  await deleteTask(session.userId, body);
});
