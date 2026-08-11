import { route } from "@/core/mutation/handler";
import { clearLogSchema, logHabitSchema } from "@/modules/habits/schema";
import { clearLog, logHabit } from "@/modules/habits/service";

export const POST = route(logHabitSchema, async ({ session, body }) => {
  await logHabit(session.userId, body);
});

export const DELETE = route(clearLogSchema, async ({ session, body }) => {
  await clearLog(session.userId, body.habitId, body.logDate);
});
