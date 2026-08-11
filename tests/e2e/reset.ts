import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Wipes the e2e account's module data before a run.
 *
 * Without this the suite accumulates rows across runs, and assertions that
 * were unambiguous on a fresh account start matching several elements — which
 * produces failures that look like app bugs but are only test drift. Resetting
 * is also what lets a test genuinely exercise a first-use state, such as
 * Calendar's "no calendars yet".
 *
 * Deletes are hard rather than soft on purpose: this is test setup, and a
 * tombstone would still be visible to the queries under test. Order follows
 * the foreign keys, since the schema is Restrict-by-default.
 *
 * The User, Profile and UserSettings rows survive, so the signed-in session
 * stays valid.
 */
export async function resetE2EData(email: string) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const userId = user.id;

    await prisma.$transaction([
      // Calendar events reference both categories and itinerary stops.
      prisma.calendarEvent.deleteMany({ where: { userId } }),
      prisma.itineraryStop.deleteMany({ where: { userId } }),
      prisma.trip.deleteMany({ where: { userId } }),
      prisma.calendarCategory.deleteMany({ where: { userId } }),

      prisma.habitLog.deleteMany({ where: { userId } }),
      prisma.habitSchedule.deleteMany({ where: { userId } }),
      prisma.habit.deleteMany({ where: { userId } }),

      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.budget.deleteMany({ where: { userId } }),
      prisma.budgetGroup.deleteMany({ where: { userId } }),
      prisma.transactionCategory.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.recurringIncome.deleteMany({ where: { userId } }),
      prisma.debt.deleteMany({ where: { userId } }),

      prisma.note.deleteMany({ where: { userId } }),
      prisma.journalEntry.deleteMany({ where: { userId } }),
      prisma.task.deleteMany({ where: { userId } }),

      prisma.vaultItem.deleteMany({ where: { userId } }),
      prisma.vaultAuditEvent.deleteMany({ where: { userId } }),
      prisma.vaultSettings.deleteMany({ where: { userId } }),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}
