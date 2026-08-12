import { readRoute, route } from "@/core/mutation/handler";
import {
  createEntrySchema,
  deleteEntrySchema,
  updateEntrySchema,
} from "@/modules/journal/schema";
import {
  createEntry,
  deleteEntry,
  findEntriesOnDate,
  listEntries,
  updateEntry,
} from "@/modules/journal/service";

export const GET = readRoute(async ({ session, searchParams }) => {
  // A4's hint: "you already wrote on this date — open it?"
  const onDate = searchParams.get("onDate");
  if (onDate) {
    const exclude = searchParams.get("exclude") ?? undefined;
    return findEntriesOnDate(session.userId, onDate, exclude);
  }
  return listEntries(session.userId);
});

export const POST = route(createEntrySchema, async ({ session, body }) => {
  await createEntry(session.userId, body);
});

export const PATCH = route(updateEntrySchema, async ({ session, body }) => {
  await updateEntry(session.userId, body);
});

export const DELETE = route(deleteEntrySchema, async ({ session, body }) => {
  await deleteEntry(session.userId, body.id);
});
