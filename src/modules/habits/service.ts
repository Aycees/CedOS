import "server-only";

import { dbDateToIso, isoToDbDate } from "@/core/date";
import { prisma } from "@/core/db/client";
import { assertOwned, live, owned, softDeleted } from "@/core/db/scope";
import { AppError } from "@/core/errors";

import {
  addDays,
  completionRate,
  computeStreaks,
  dueDatesBetween,
  isDueOn,
  paceStatus,
  progressOf,
  scheduleOn,
  weekBounds,
} from "./engine/cadence";
import type { Log, Schedule } from "./engine/types";
import {
  cadenceLabel,
  type CreateHabitInput,
  type HabitHistoryView,
  type HabitTodayView,
  type LogHabitInput,
  type TimeSlot,
  type UpdateHabitInput,
} from "./schema";

/**
 * The only place in this module that touches Prisma (decision log §7).
 *
 * Every judgement about due-ness, pace, streaks and rates is delegated to
 * engine/cadence.ts. This file's job is to load rows, hand them to pure
 * functions, and write results back — never to re-implement the date maths.
 */

type ScheduleRow = {
  id: string;
  cadenceType: string;
  weekdays: number[];
  timesPerWeek: number | null;
  intervalDays: number | null;
  anchorDate: Date | null;
  completionType: string;
  targetValue: unknown;
  unit: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

type LogRow = {
  logDate: Date;
  status: string;
  value: unknown;
  targetSnapshot: unknown;
};

function toSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    cadenceType: row.cadenceType as Schedule["cadenceType"],
    weekdays: row.weekdays,
    timesPerWeek: row.timesPerWeek,
    intervalDays: row.intervalDays,
    anchorDate: row.anchorDate ? dbDateToIso(row.anchorDate) : null,
    completionType: row.completionType as Schedule["completionType"],
    targetValue: row.targetValue === null ? null : Number(row.targetValue),
    unit: row.unit,
    effectiveFrom: dbDateToIso(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? dbDateToIso(row.effectiveTo) : null,
  };
}

function toLog(row: LogRow): Log {
  return {
    logDate: dbDateToIso(row.logDate),
    status: row.status as Log["status"],
    value: row.value === null ? null : Number(row.value),
    targetSnapshot: row.targetSnapshot === null ? null : Number(row.targetSnapshot),
  };
}

async function loadHabits(userId: string, includeArchived: boolean) {
  return prisma.habit.findMany({
    where: live(userId, includeArchived ? {} : { archivedAt: null }),
    orderBy: { createdAt: "asc" },
    include: {
      schedules: { orderBy: { effectiveFrom: "desc" } },
      logs: { orderBy: { logDate: "desc" } },
    },
  });
}

/** The today view: habits due today, grouped by time slot in the UI. */
export async function listToday(
  userId: string,
  today: string,
  weekStartsOn: number,
): Promise<HabitTodayView[]> {
  const habits = await loadHabits(userId, false);

  return habits
    .map((habit) => {
      const schedules = habit.schedules.map(toSchedule);
      const logs = habit.logs.map(toLog);
      const active = scheduleOn(schedules, today);
      if (!active || !isDueOn(active, today)) return null;

      const todayLog = logs.find((log) => log.logDate === today) ?? null;
      const { start, end } = weekBounds(today, weekStartsOn);
      const weekLogs = logs.filter((log) => log.logDate >= start && log.logDate <= end);

      // Archiving freezes the streak at the archive date rather than letting
      // it decay as unlogged days pile up (product spec §8).
      const upTo = habit.archivedAt ? dbDateToIso(habit.archivedAt) : today;
      const streaks = computeStreaks(logs, schedules, upTo, weekStartsOn);

      return {
        id: habit.id,
        name: habit.name,
        color: habit.color,
        timeSlot: habit.timeSlot as TimeSlot,
        archivedAt: habit.archivedAt?.toISOString() ?? null,
        cadenceType: active.cadenceType,
        cadenceLabel: cadenceLabel(active),
        completionType: active.completionType,
        targetValue: active.targetValue,
        unit: active.unit,
        status: todayLog?.status ?? null,
        value: todayLog?.value ?? null,
        progress: todayLog ? progressOf(todayLog, active) : 0,
        pace: paceStatus(active, today, weekLogs, weekStartsOn),
        currentStreak: streaks.current,
        bestStreak: streaks.best,
        weekRate: completionRate(logs, schedules, addDays(today, -6), today),
      } satisfies HabitTodayView;
    })
    .filter((view): view is HabitTodayView => view !== null);
}

/** The history grid: one row per habit over a trailing window. */
export async function listHistory(
  userId: string,
  today: string,
  days = 84,
  weekStartsOn = 1,
): Promise<HabitHistoryView[]> {
  const habits = await loadHabits(userId, true);
  const from = addDays(today, -(days - 1));

  return habits.map((habit) => {
    const schedules = habit.schedules.map(toSchedule);
    const logs = habit.logs.map(toLog);
    const logsByDate = new Map(logs.map((log) => [log.logDate, log]));
    const dueDates = new Set(dueDatesBetween(schedules, from, today));

    const cells = [];
    for (let date = from; date <= today; date = addDays(date, 1)) {
      const schedule = scheduleOn(schedules, date);
      const log = logsByDate.get(date);
      cells.push({
        date,
        due: dueDates.has(date),
        progress: log && schedule ? progressOf(log, schedule) : 0,
        status: log?.status ?? null,
      });
    }

    const upTo = habit.archivedAt ? dbDateToIso(habit.archivedAt) : today;
    const streaks = computeStreaks(logs, schedules, upTo, weekStartsOn);

    return {
      id: habit.id,
      name: habit.name,
      color: habit.color,
      cells,
      currentStreak: streaks.current,
      bestStreak: streaks.best,
    };
  });
}

/** Rolled up across every habit — "best streak across all habits" (spec §8). */
export async function habitSummary(
  userId: string,
  today: string,
  weekStartsOn: number,
) {
  const habits = await loadHabits(userId, false);

  let bestOverall = 0;
  let dueToday = 0;
  let doneToday = 0;

  for (const habit of habits) {
    const schedules = habit.schedules.map(toSchedule);
    const logs = habit.logs.map(toLog);
    const active = scheduleOn(schedules, today);
    if (!active) continue;

    bestOverall = Math.max(
      bestOverall,
      computeStreaks(logs, schedules, today, weekStartsOn).best,
    );

    if (isDueOn(active, today)) {
      dueToday += 1;
      const log = logs.find((entry) => entry.logDate === today);
      if (log && progressOf(log, active) >= 1) doneToday += 1;
    }
  }

  return { bestOverall, dueToday, doneToday };
}

export async function countDueToday(
  userId: string,
  today: string,
  weekStartsOn: number,
): Promise<number> {
  const { dueToday, doneToday } = await habitSummary(userId, today, weekStartsOn);
  return dueToday - doneToday;
}

export async function createHabit(userId: string, input: CreateHabitInput) {
  return prisma.$transaction(async (tx) => {
    const habit = await tx.habit.create({
      data: {
        id: input.id,
        userId,
        name: input.name,
        color: input.color,
        timeSlot: input.timeSlot,
      },
    });

    await tx.habitSchedule.create({
      data: {
        id: input.scheduleId,
        userId,
        habitId: habit.id,
        ...cadenceData(input.cadence),
        effectiveFrom: isoToDbDate(input.today),
      },
    });

    return habit;
  });
}

/**
 * Identity changes edit in place; cadence or target changes open a new
 * schedule version (decision A6).
 *
 * The previous version is closed the day before the new one opens, so the
 * two never overlap — the partial unique index on `effective_to IS NULL`
 * enforces that there is exactly one open version at a time.
 */
export async function updateHabit(userId: string, input: UpdateHabitInput) {
  const habit = await prisma.habit.findUnique({
    where: { id: input.id },
    include: { schedules: { where: { effectiveTo: null } } },
  });
  assertOwned(habit, userId, "habit");

  await prisma.$transaction(async (tx) => {
    await tx.habit.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.timeSlot !== undefined ? { timeSlot: input.timeSlot } : {}),
      },
    });

    if (!input.cadence || !input.scheduleId || !input.today) return;

    const open = habit!.schedules[0];
    if (open) {
      const from = dbDateToIso(open.effectiveFrom);
      // A version cannot end before it began: if the cadence changes on the
      // same day it was created, replace that version rather than closing it.
      if (from >= input.today) {
        await tx.habitSchedule.update({
          where: { id: open.id },
          data: cadenceData(input.cadence),
        });
        return;
      }

      await tx.habitSchedule.update({
        where: { id: open.id },
        data: { effectiveTo: isoToDbDate(addDays(input.today, -1)) },
      });
    }

    await tx.habitSchedule.create({
      data: {
        id: input.scheduleId,
        userId,
        habitId: input.id,
        ...cadenceData(input.cadence),
        effectiveFrom: isoToDbDate(input.today),
      },
    });
  });
}

/**
 * Records a completion or a skip.
 *
 * The target and unit in force on that date are snapshotted onto the log
 * (A6), and the log points at the schedule version it was measured under —
 * the double link that makes historical scoring correct.
 */
export async function logHabit(userId: string, input: LogHabitInput) {
  const habit = await prisma.habit.findUnique({
    where: { id: input.habitId },
    include: { schedules: true },
  });
  assertOwned(habit, userId, "habit");

  const schedules = habit!.schedules.map(toSchedule);
  const schedule = scheduleOn(schedules, input.logDate);
  if (!schedule) {
    throw new AppError(
      "PRECONDITION_FAILED",
      "This habit had no schedule on that date.",
    );
  }

  if (schedule.completionType === "COUNT" && input.status === "LOGGED") {
    if (input.value === null) {
      throw new AppError("VALIDATION_ERROR", "How much did you do?", {
        value: ["This habit is measured, so it needs an amount."],
      });
    }
  }

  const data = {
    status: input.status,
    value: schedule.completionType === "COUNT" ? input.value : null,
    targetSnapshot: schedule.targetValue,
    unitSnapshot: schedule.unit,
    scheduleId: schedule.id,
  };

  return prisma.habitLog.upsert({
    where: { habitId_logDate: { habitId: input.habitId, logDate: isoToDbDate(input.logDate) } },
    update: data,
    create: {
      id: input.id,
      userId,
      habitId: input.habitId,
      logDate: isoToDbDate(input.logDate),
      ...data,
    },
  });
}

/**
 * Removes a log entirely, returning the day to "not done".
 *
 * The absence of a row is what "not done" means (system design §3.5), so
 * un-ticking a habit deletes rather than writing a third status.
 */
export async function clearLog(userId: string, habitId: string, logDate: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  assertOwned(habit, userId, "habit");

  await prisma.habitLog.deleteMany({
    where: owned(userId, { habitId, logDate: isoToDbDate(logDate) }),
  });
}

/** Soft-remove that keeps history, distinct from deletion (product spec §8). */
export async function archiveHabit(
  userId: string,
  id: string,
  archived: boolean,
  today: string,
) {
  const habit = await prisma.habit.findUnique({ where: { id } });
  assertOwned(habit, userId, "habit");

  await prisma.habit.update({
    where: { id },
    data: { archivedAt: archived ? isoToDbDate(today) : null },
  });
}

export async function deleteHabit(userId: string, id: string) {
  const habit = await prisma.habit.findUnique({ where: { id } });
  assertOwned(habit, userId, "habit");

  await prisma.habit.update({ where: { id }, data: softDeleted() });
}

function cadenceData(cadence: CreateHabitInput["cadence"]) {
  return {
    cadenceType: cadence.cadenceType,
    weekdays: cadence.cadenceType === "WEEKDAYS" ? cadence.weekdays : [],
    timesPerWeek: cadence.cadenceType === "TIMES_PER_WEEK" ? cadence.timesPerWeek : null,
    intervalDays: cadence.cadenceType === "INTERVAL" ? cadence.intervalDays : null,
    anchorDate:
      cadence.cadenceType === "INTERVAL" && cadence.anchorDate
        ? isoToDbDate(cadence.anchorDate)
        : null,
    completionType: cadence.completionType,
    targetValue: cadence.completionType === "COUNT" ? cadence.targetValue : null,
    unit: cadence.completionType === "COUNT" ? cadence.unit : null,
  };
}
