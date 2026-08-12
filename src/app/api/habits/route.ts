import { readRoute, route } from "@/core/mutation/handler";
import {
  createHabitSchema,
  deleteHabitSchema,
  updateHabitSchema,
} from "@/modules/habits/schema";
import {
  createHabit,
  deleteHabit,
  listHistory,
  listToday,
  updateHabit,
} from "@/modules/habits/service";
import { getSettings } from "@/modules/settings/service";

export const GET = readRoute(async ({ session, searchParams }) => {
  const settings = await getSettings(session.userId);
  const today =
    searchParams.get("today") ?? new Date().toISOString().slice(0, 10);

  if (searchParams.get("view") === "history") {
    return listHistory(session.userId, today, 84, settings.weekStartsOn);
  }
  return listToday(session.userId, today, settings.weekStartsOn);
});

export const POST = route(createHabitSchema, async ({ session, body }) => {
  await createHabit(session.userId, body);
});

export const PATCH = route(updateHabitSchema, async ({ session, body }) => {
  await updateHabit(session.userId, body);
});

export const DELETE = route(deleteHabitSchema, async ({ session, body }) => {
  await deleteHabit(session.userId, body.id);
});
