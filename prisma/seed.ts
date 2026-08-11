import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { DateTime } from "luxon";
import { uuidv7 } from "uuidv7";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Development seed.
 *
 * System design §7 asks for enough data that the engines can be judged by
 * eye — most importantly ~6 months of habit logs across multiple schedule
 * versions, since "the bugs that matter only appear over long spans". That
 * part lands with phase 5; what exists now seeds the modules that exist now.
 *
 * The user row is keyed to a Supabase auth UID. Pass one in as SEED_USER_ID
 * (sign up first, then copy the id from Studio), or let the script create a
 * standalone row for pure-Prisma work.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TIMEZONE = "Asia/Manila";

async function main() {
  const userId = process.env.SEED_USER_ID ?? uuidv7();
  const email = process.env.SEED_EMAIL ?? "you@example.com";

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      id: uuidv7(),
      userId: user.id,
      name: "Mika",
      pronouns: "they/them",
      birthday: isoDate("1999-04-23"),
      location: "Manila, Philippines",
      timezone: TIMEZONE,
      bio: "Keeping the threads of a life in one place.",
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { id: uuidv7(), userId: user.id },
  });

  await seedTasks(user.id);
  await seedJournal(user.id);

  console.log(`Seeded user ${user.id} (${email})`);
  if (!process.env.SEED_USER_ID) {
    console.log(
      "No SEED_USER_ID given, so this user has no Supabase auth account.\n" +
        "Sign up in the app, then re-run with SEED_USER_ID=<auth uid> to attach this data.",
    );
  }
}

async function seedTasks(userId: string) {
  if (await prisma.task.count({ where: { userId } })) return;

  const now = DateTime.now().setZone(TIMEZONE);

  await prisma.task.createMany({
    data: [
      task(userId, "Email advisor re: sample size", "TODAY", 1),
      task(userId, "Pay water bill", "TODAY", 2),
      // Completed today — visible, struck through.
      task(userId, "Book dentist", "TODAY", 3, now.toJSDate()),
      // Completed 9 days ago — collapses behind "show completed" (A3).
      task(userId, "Renew domain", "TODAY", 4, now.minus({ days: 9 }).toJSDate()),
      task(userId, "Draft chapter 3 outline", "THIS_WEEK", 1),
      task(userId, "Return library books", "THIS_WEEK", 2),
      task(userId, "Learn to develop film", "SOMEDAY", 1),
    ],
  });
}

async function seedJournal(userId: string) {
  if (await prisma.journalEntry.count({ where: { userId } })) return;

  const today = DateTime.now().setZone(TIMEZONE);

  await prisma.journalEntry.createMany({
    data: [
      entry(
        userId,
        today.toFormat("yyyy-MM-dd"),
        "Slow morning. The rain held off long enough for the walk to the market, " +
          "which felt like getting away with something.",
      ),
      // Two entries on one date — A4 allows this deliberately, and the seed
      // includes it so the "you already wrote on this date" hint is visible
      // without having to manufacture the case by hand.
      entry(
        userId,
        today.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        "Second pass at the methods section. Still not right, but closer.",
      ),
      entry(
        userId,
        today.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        "Late addition: called home. Lola sounded well.",
      ),
      entry(
        userId,
        today.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        "Long day. Writing this mostly so the streak of blank days ends here.",
      ),
    ],
  });
}

function task(
  userId: string,
  title: string,
  bucket: "TODAY" | "THIS_WEEK" | "SOMEDAY",
  sortOrder: number,
  completedAt?: Date,
) {
  return { id: uuidv7(), userId, title, bucket, sortOrder, completedAt };
}

function entry(userId: string, entryDate: string, body: string) {
  return { id: uuidv7(), userId, entryDate: isoDate(entryDate), body };
}

/** @db.Date columns are UTC-midnight Dates — see core/date. */
function isoDate(value: string): Date {
  return DateTime.fromFormat(value, "yyyy-MM-dd", { zone: "utc" }).toJSDate();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
