import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date like 2026-08-11.");

export const createNoteSchema = z.object({
  id: z.uuid(),
  /** Empty is allowed; the UI renders "Untitled" (product spec §6). */
  title: z.string().trim().max(300).default(""),
  tag: z.string().trim().max(60).nullable().optional(),
  noteDate: isoDate,
  /** Raw markdown — the stored form. Never rendered HTML. */
  body: z.string().max(200_000).default(""),
});

export const updateNoteSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().max(300).optional(),
  tag: z.string().trim().max(60).nullable().optional(),
  noteDate: isoDate.optional(),
  body: z.string().max(200_000).optional(),
});

export const deleteNoteSchema = z.object({ id: z.uuid() });

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export type NoteView = {
  id: string;
  title: string;
  tag: string | null;
  noteDate: string;
  body: string;
};

/** What the UI shows when a note has no title (product spec §6). */
export const UNTITLED = "Untitled";

export function displayTitle(note: { title: string }): string {
  return note.title.trim() || UNTITLED;
}
