import "server-only";

import { AppError } from "@/core/errors";

/**
 * The data-access boundary.
 *
 * Decision log §5 makes the app layer the primary security model, because
 * Prisma connects as a privileged role and bypasses row-level security
 * entirely. That decision is only real if every query is scoped — so these
 * helpers take `userId` as a required first argument, and modules build their
 * `where` clauses through them rather than by hand.
 *
 * Two distinct helpers, because not every model is soft-deletable:
 *
 *   · `live`  — user-generated data carrying `deletedAt`. Filters it out.
 *   · `owned` — models without `deletedAt` (Profile, UserSettings,
 *               HabitSchedule, HabitLog, VaultSettings, VaultAuditEvent).
 *
 * Reaching for `owned` on a soft-deletable model is the mistake to watch for:
 * it silently returns deleted rows.
 */

/** Rows owned by this user that have not been soft-deleted. */
export function live<T extends object>(userId: string, extra?: T) {
  requireUserId(userId);
  return { userId, deletedAt: null, ...(extra ?? ({} as T)) };
}

/** Rows owned by this user, on a model that has no `deletedAt`. */
export function owned<T extends object>(userId: string, extra?: T) {
  requireUserId(userId);
  return { userId, ...(extra ?? ({} as T)) };
}

/**
 * Includes soft-deleted rows. Deliberately verbose to name at the call site —
 * only undo/restore flows and the JSON export (G2) have any business here.
 */
export function includingDeleted<T extends object>(userId: string, extra?: T) {
  requireUserId(userId);
  return { userId, ...(extra ?? ({} as T)) };
}

/**
 * The update payload for a soft delete. Nothing in the app issues a hard
 * DELETE against user data: tombstones are what give undo, and what the
 * deferred offline sync will need (technical decisions §1).
 */
export function softDeleted() {
  return { deletedAt: new Date() };
}

/**
 * Guards a record fetched by id. Returns 404 rather than 403 when the record
 * belongs to someone else — telling a stranger that a row exists but is not
 * theirs leaks the existence of that row.
 */
export function assertOwned<T extends { userId: string; deletedAt?: Date | null }>(
  record: T | null,
  userId: string,
  label: string,
): T {
  if (!record || record.userId !== userId || record.deletedAt) {
    throw new AppError("NOT_FOUND", `That ${label} could not be found.`);
  }
  return record;
}

function requireUserId(userId: string): void {
  if (!userId) {
    throw new AppError(
      "UNAUTHENTICATED",
      "A query reached the database without a user scope.",
    );
  }
}
