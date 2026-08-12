import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date like 2026-08-11.");

export const createEntrySchema = z.object({
  /** Client-generated UUIDv7 — non-negotiable #1. */
  id: z.uuid(),
  /**
   * Editable, so backdating works: writing today about yesterday is normal
   * journalling, and forcing "today only" would be wrong (product spec §7).
   */
  entryDate: isoDate,
  body: z.string().max(100_000),
});

export const updateEntrySchema = z.object({
  id: z.uuid(),
  entryDate: isoDate.optional(),
  body: z.string().max(100_000).optional(),
});

export const deleteEntrySchema = z.object({ id: z.uuid() });

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export type EntryView = {
  id: string;
  entryDate: string;
  body: string;
};
