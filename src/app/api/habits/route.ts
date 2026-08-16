import { readRoute, route } from "@/core/mutation/handler";
import { addDays, daysBetween, weekBounds } from "@/modules/habits/engine/cadence";
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

/** 26 weeks back, aligned to the Sunday that starts the current week — the History heatmap's column grid needs whole weeks, not just a trailing day count. */
const HISTORY_WEEKS = 26;

export const GET = readRoute(async ({ session, searchParams }) => {
  const settings = await getSettings(session.userId);
  const today =
    searchParams.get("today") ?? new Date().toISOString().slice(0, 10);

  if (searchParams.get("view") === "history") {
    const { start: weekStart } = weekBounds(today, 7);
    const gridStart = addDays(weekStart, -(HISTORY_WEEKS - 1) * 7);
    const days = daysBetween(gridStart, today) + 1;
    return listHistory(session.userId, today, days, settings.weekStartsOn);
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
