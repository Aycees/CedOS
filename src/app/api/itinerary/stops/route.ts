import { route } from "@/core/mutation/handler";
import {
  createStopSchema,
  deleteStopSchema,
  updateStopSchema,
} from "@/modules/itinerary/schema";
import { createStop, deleteStop, updateStop } from "@/modules/itinerary/service";

export const POST = route(createStopSchema, async ({ session, body }) => {
  await createStop(session.userId, body);
});

export const PATCH = route(updateStopSchema, async ({ session, body }) => {
  await updateStop(session.userId, body);
});

export const DELETE = route(deleteStopSchema, async ({ session, body }) => {
  await deleteStop(session.userId, body.id);
});
