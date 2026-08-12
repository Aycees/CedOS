import { readRoute, route } from "@/core/mutation/handler";
import {
  createNoteSchema,
  deleteNoteSchema,
  updateNoteSchema,
} from "@/modules/notes/schema";
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
} from "@/modules/notes/service";

export const GET = readRoute(({ session, searchParams }) =>
  listNotes(session.userId, {
    query: searchParams.get("q") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
  }),
);

export const POST = route(createNoteSchema, async ({ session, body }) => {
  await createNote(session.userId, body);
});

export const PATCH = route(updateNoteSchema, async ({ session, body }) => {
  await updateNote(session.userId, body);
});

export const DELETE = route(deleteNoteSchema, async ({ session, body }) => {
  await deleteNote(session.userId, body.id);
});
