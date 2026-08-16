import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { DateTime } from "luxon";
import { uuidv7 } from "uuidv7";

import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, daysBetween, dueDatesBetween, weekBounds } from "../src/modules/habits/engine/cadence";
import type { CadenceType, CompletionType, IsoDate, Schedule } from "../src/modules/habits/engine/types";

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
  await seedHabits(user.id);

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

type HabitDef = {
  name: string;
  color: string;
  timeSlot: "MORNING" | "AFTERNOON" | "EVENING" | "ANYTIME";
  cadenceType: CadenceType;
  weekdays?: number[];
  timesPerWeek?: number;
  intervalDays?: number;
  completionType: CompletionType;
  targetValue?: number;
  unit?: string;
  /** Baseline recent-weeks success rate (0–1); ramps up further for the trailing 3 weeks. */
  strength: number;
};

const HABIT_DEFS: HabitDef[] = [
  {
    name: "Water",
    color: "blue",
    timeSlot: "ANYTIME",
    cadenceType: "DAILY",
    completionType: "COUNT",
    targetValue: 8,
    unit: "glasses",
    strength: 0.8,
  },
  {
    name: "Morning walk",
    color: "green",
    timeSlot: "MORNING",
    cadenceType: "TIMES_PER_WEEK",
    timesPerWeek: 4,
    completionType: "BINARY",
    strength: 0.85,
  },
  {
    name: "Read",
    color: "sky",
    timeSlot: "EVENING",
    cadenceType: "DAILY",
    completionType: "COUNT",
    targetValue: 20,
    unit: "pages",
    strength: 0.6,
  },
  {
    name: "Log the day's spending",
    color: "terracotta",
    timeSlot: "EVENING",
    cadenceType: "DAILY",
    completionType: "BINARY",
    strength: 0.75,
  },
  {
    name: "Thesis block",
    color: "violet",
    timeSlot: "MORNING",
    cadenceType: "WEEKDAYS",
    weekdays: [1, 2, 3, 4, 5],
    completionType: "COUNT",
    targetValue: 90,
    unit: "min",
    strength: 0.55,
  },
  {
    name: "Stretch",
    color: "mauve",
    timeSlot: "ANYTIME",
    cadenceType: "DAILY",
    completionType: "BINARY",
    strength: 0.5,
  },
  {
    name: "Take vitamins",
    color: "red",
    timeSlot: "MORNING",
    cadenceType: "DAILY",
    completionType: "BINARY",
    strength: 0.9,
  },
  {
    name: "Meal prep",
    color: "warmgray",
    timeSlot: "AFTERNOON",
    cadenceType: "INTERVAL",
    intervalDays: 7,
    completionType: "BINARY",
    strength: 0.7,
  },
];

const HABIT_SEED_DAYS = 200;

/**
 * ~6.5 months of logs per habit, generated against the real cadence engine
 * (`dueDatesBetween`) rather than hand-rolled date math — the point is to
 * exercise the same due-date/streak/rate logic the app runs live, per system
 * design §7 ("bugs that matter only appear over long spans").
 */
async function seedHabits(userId: string) {
  if (await prisma.habit.count({ where: { userId } })) return;

  const today = DateTime.now().setZone(TIMEZONE).toFormat("yyyy-MM-dd");
  const start = addDays(today, -HABIT_SEED_DAYS);

  for (const def of HABIT_DEFS) {
    const habitId = uuidv7();
    const scheduleId = uuidv7();
    const anchorDate = def.cadenceType === "INTERVAL" ? start : null;

    const schedule: Schedule = {
      id: scheduleId,
      cadenceType: def.cadenceType,
      weekdays: def.weekdays ?? [],
      timesPerWeek: def.timesPerWeek ?? null,
      intervalDays: def.intervalDays ?? null,
      anchorDate,
      completionType: def.completionType,
      targetValue: def.targetValue ?? null,
      unit: def.unit ?? null,
      effectiveFrom: start,
      effectiveTo: null,
    };

    await prisma.habit.create({
      data: { id: habitId, userId, name: def.name, color: def.color, timeSlot: def.timeSlot },
    });

    await prisma.habitSchedule.create({
      data: {
        id: scheduleId,
        userId,
        habitId,
        cadenceType: schedule.cadenceType,
        weekdays: schedule.weekdays,
        timesPerWeek: schedule.timesPerWeek,
        intervalDays: schedule.intervalDays,
        anchorDate: anchorDate ? isoDate(anchorDate) : null,
        completionType: schedule.completionType,
        targetValue: schedule.targetValue,
        unit: schedule.unit,
        effectiveFrom: isoDate(start),
        effectiveTo: null,
      },
    });

    const logs = simulateLogs(schedule, start, today, def.strength);
    if (logs.length === 0) continue;

    await prisma.habitLog.createMany({
      data: logs.map((log) => ({
        id: uuidv7(),
        userId,
        habitId,
        scheduleId,
        logDate: isoDate(log.date),
        status: log.status,
        value: log.value,
        targetSnapshot: schedule.targetValue,
        unitSnapshot: schedule.unit,
      })),
    });
  }
}

type SimLog = { date: IsoDate; status: "LOGGED" | "SKIPPED"; value: number | null };

const SKIP_CHANCE = 0.06;
/** Recent weeks lean toward success so the current streak/heatmap tail reads well. */
const RECENT_WINDOW_DAYS = 21;
const RECENT_BOOST = 0.15;

function successChance(date: IsoDate, today: IsoDate, base: number): number {
  const boosted = daysBetween(date, today) <= RECENT_WINDOW_DAYS ? base + RECENT_BOOST : base;
  return Math.min(0.95, Math.max(0.15, boosted));
}

function simulateLogs(
  schedule: Schedule,
  start: IsoDate,
  today: IsoDate,
  strength: number,
): SimLog[] {
  const rng = mulberry32(hashSeed(schedule.id));

  if (schedule.cadenceType === "TIMES_PER_WEEK") {
    return simulateTimesPerWeek(schedule, start, today, strength, rng);
  }

  const results: SimLog[] = [];
  for (const date of dueDatesBetween([schedule], start, today)) {
    const chance = successChance(date, today, strength);
    const roll = rng();

    if (roll < SKIP_CHANCE) {
      results.push({ date, status: "SKIPPED", value: null });
      continue;
    }
    if (roll < SKIP_CHANCE + chance * (1 - SKIP_CHANCE)) {
      results.push({ date, status: "LOGGED", value: countValue(schedule, rng) });
    }
    // Otherwise: a genuine miss — no row at all.
  }
  return results;
}

/** TIMES_PER_WEEK is due every day (A5), so completion is a per-week pick rather than a per-day roll. */
function simulateTimesPerWeek(
  schedule: Schedule,
  start: IsoDate,
  today: IsoDate,
  strength: number,
  rng: () => number,
): SimLog[] {
  const results: SimLog[] = [];
  const target = schedule.timesPerWeek ?? 1;
  let cursor = weekBounds(start, 1).start;

  while (cursor <= today) {
    const { end } = weekBounds(cursor, 1);
    const weekEnd = end > today ? today : end;
    const candidates: IsoDate[] = [];
    for (let d = cursor < start ? start : cursor; d <= weekEnd; d = addDays(d, 1)) {
      candidates.push(d);
    }

    const chance = successChance(cursor, today, strength);
    const shortfall = rng() < chance ? 0 : 1 + Math.floor(rng() * 2);
    const picks = Math.max(0, Math.min(target, candidates.length) - shortfall);

    const shuffled = [...candidates].sort(() => rng() - 0.5).slice(0, picks).sort();
    for (const date of shuffled) results.push({ date, status: "LOGGED", value: null });

    cursor = addDays(end, 1);
  }
  return results;
}

/** A logged COUNT day spans a bit under to well over target — some partial credit, mostly hits. */
function countValue(schedule: Schedule, rng: () => number): number | null {
  if (schedule.completionType !== "COUNT" || !schedule.targetValue) return null;
  const factor = 0.7 + rng() * 0.7;
  return Math.round(schedule.targetValue * factor * 100) / 100;
}

/** Small deterministic PRNG so a given habit's pattern is stable across seed runs. */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
