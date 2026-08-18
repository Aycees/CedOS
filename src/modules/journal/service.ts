import "server-only";

import { dbDateToIso, isoToDbDate } from "@/core/date";
import { prisma } from "@/core/db/client";
import { assertOwned, live, softDeleted } from "@/core/db/scope";

import type {
  CreateEntryInput,
  EntryView,
  UpdateEntryInput,
} from "./schema";

/** The only place in this module that touches Prisma (decision log §7). */

export async function listEntries(userId: string): Promise<EntryView[]> {
  const entries = await prisma.journalEntry.findMany({
    where: live(userId),
    // Reverse-chronological (product spec §7). createdAt breaks ties so that
    // two entries written on the same date keep a stable, meaningful order —
    // which A4 makes a normal case rather than an edge one.
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    // Long-form prose, roughly one entry a day, kept forever. The two-pane
    // view reads from the top of this list, so it never needs all of it.
    take: 200,
  });

  return entries.map(toView);
}

/**
 * Backs the non-blocking "you already wrote on this date — open it?" hint.
 *
 * Decision A4 allows multiple entries per date deliberately: a unique
 * constraint would turn a second reflection into an error state, which is
 * the wrong response in a calm, reflective app. So this is a hint, never a
 * block, and it excludes the entry being edited.
 */
export async function findEntriesOnDate(
  userId: string,
  entryDate: string,
  excludeId?: string,
): Promise<EntryView[]> {
  const entries = await prisma.journalEntry.findMany({
    where: live(userId, { entryDate: isoToDbDate(entryDate) }),
    orderBy: { createdAt: "desc" },
  });

  return entries.filter((entry) => entry.id !== excludeId).map(toView);
}

export async function createEntry(userId: string, input: CreateEntryInput) {
  return prisma.journalEntry.create({
    data: {
      id: input.id,
      userId,
      entryDate: isoToDbDate(input.entryDate),
      body: input.body,
    },
  });
}

export async function updateEntry(userId: string, input: UpdateEntryInput) {
  const existing = await prisma.journalEntry.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "entry");

  return prisma.journalEntry.update({
    where: { id: input.id },
    data: {
      ...(input.entryDate !== undefined
        ? { entryDate: isoToDbDate(input.entryDate) }
        : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
    },
  });
}

export async function deleteEntry(userId: string, id: string) {
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  assertOwned(existing, userId, "entry");

  await prisma.journalEntry.update({ where: { id }, data: softDeleted() });
}

function toView(entry: { id: string; entryDate: Date; body: string }): EntryView {
  return {
    id: entry.id,
    entryDate: dbDateToIso(entry.entryDate),
    body: entry.body,
  };
}
