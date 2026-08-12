import { route } from "@/core/mutation/handler";
import { archiveHabitSchema } from "@/modules/habits/schema";
import { archiveHabit } from "@/modules/habits/service";

/**
 * Archiving is its own endpoint rather than a field on the edit payload:
 * it is a soft-remove that keeps history (product spec §8), and it freezes
 * the streak at the archive date — different enough from renaming a habit to
 * deserve its own verb.
 */
export const PATCH = route(archiveHabitSchema, async ({ session, body }) => {
  await archiveHabit(session.userId, body.id, body.archived, body.today);
});
