import "server-only";

import { dbDateToIso, isoToDbDate } from "@/core/date";
import { prisma } from "@/core/db/client";
import { assertOwned, live, softDeleted } from "@/core/db/scope";

import type { CreateNoteInput, NoteView, UpdateNoteInput } from "./schema";

/** The only place in this module that touches Prisma (decision log §7). */

export async function listNotes(
  userId: string,
  options: { query?: string; tag?: string } = {},
): Promise<NoteView[]> {
  const query = options.query?.trim();

  /*
   * Search runs against the generated tsvector column with its GIN index
   * (system design §6), not a LIKE scan. `websearch_to_tsquery` is the
   * forgiving parser — it accepts what a person actually types, including
   * bare words and quoted phrases, rather than demanding tsquery syntax.
   *
   * The tsvector covers title and body. Tag is matched separately with a
   * plain ILIKE so that searching "school" finds notes tagged school even
   * when the word appears nowhere in the text.
   */
  if (query) {
    const rows = await prisma.$queryRaw<
      { id: string; title: string; tag: string | null; note_date: Date; body: string }[]
    >`
      SELECT id, title, tag, note_date, body
      FROM notes
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        AND (
          search_vector @@ websearch_to_tsquery('english', ${query})
          OR tag ILIKE ${`%${query}%`}
        )
      ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${query})) DESC,
               note_date DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      tag: row.tag,
      noteDate: dbDateToIso(row.note_date),
      body: row.body,
    }));
  }

  const notes = await prisma.note.findMany({
    where: live(userId, options.tag ? { tag: options.tag } : {}),
    orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
  });

  return notes.map(toView);
}

/** The distinct tags in use, for the filter row. */
export async function listTags(userId: string): Promise<string[]> {
  const rows = await prisma.note.findMany({
    where: live(userId, { NOT: { tag: null } }),
    select: { tag: true },
    distinct: ["tag"],
    orderBy: { tag: "asc" },
  });
  return rows.map((row) => row.tag!).filter(Boolean);
}

export async function createNote(userId: string, input: CreateNoteInput) {
  return prisma.note.create({
    data: {
      id: input.id,
      userId,
      title: input.title,
      tag: input.tag?.trim() || null,
      noteDate: isoToDbDate(input.noteDate),
      body: input.body,
    },
  });
}

export async function updateNote(userId: string, input: UpdateNoteInput) {
  const existing = await prisma.note.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "note");

  return prisma.note.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.tag !== undefined ? { tag: input.tag?.trim() || null } : {}),
      ...(input.noteDate !== undefined ? { noteDate: isoToDbDate(input.noteDate) } : {}),
      // Stored exactly as typed. Round-tripping through HTML is where
      // formatting fidelity gets lost (system design §3.4).
      ...(input.body !== undefined ? { body: input.body } : {}),
    },
  });
}

export async function deleteNote(userId: string, id: string) {
  const existing = await prisma.note.findUnique({ where: { id } });
  assertOwned(existing, userId, "note");

  await prisma.note.update({ where: { id }, data: softDeleted() });
}

function toView(note: {
  id: string;
  title: string;
  tag: string | null;
  noteDate: Date;
  body: string;
}): NoteView {
  return {
    id: note.id,
    title: note.title,
    tag: note.tag,
    noteDate: dbDateToIso(note.noteDate),
    body: note.body,
  };
}
