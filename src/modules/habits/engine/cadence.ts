import { DateTime } from "luxon";

import type {
  IsoDate,
  Log,
  PaceStatus,
  Schedule,
  Streaks,
} from "./types";

/**
 * The habit cadence engine.
 *
 * No I/O, no Prisma, no `Date.now()` — every function takes the dates it needs
 * (system design §5.1). The risk table names habit date maths as the highest
 * bug density in the spec, and the reason is that its failures are silent: a
 * wrong due-date does not throw, it just quietly marks a good day as missed.
 *
 * All arithmetic happens on plain calendar dates parsed in UTC. That is what
 * makes DST structurally irrelevant here: an interval habit steps by whole
 * days regardless of what the user's zone does with its clocks. The zone
 * matters only for deciding which calendar day "today" is, which happens
 * outside this module in core/date.
 */

const ISO = "yyyy-MM-dd";

function parse(date: IsoDate): DateTime {
  const parsed = DateTime.fromFormat(date, ISO, { zone: "utc" });
  if (!parsed.isValid) throw new Error(`Not a calendar date: ${date}`);
  return parsed;
}

/** Whole days between two calendar dates. Never fractional, never zone-skewed. */
function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round(parse(to).diff(parse(from), "days").days);
}

function addDays(date: IsoDate, days: number): IsoDate {
  return parse(date).plus({ days }).toFormat(ISO);
}

/** The schedule version in effect on a date, or null if the habit had none yet. */
export function scheduleOn(
  schedules: Schedule[],
  date: IsoDate,
): Schedule | null {
  return (
    schedules.find(
      (schedule) =>
        schedule.effectiveFrom <= date &&
        (schedule.effectiveTo === null || date <= schedule.effectiveTo),
    ) ?? null
  );
}

/**
 * Whether a habit is due on a date under a given schedule version.
 *
 * TIMES_PER_WEEK returns true every day by decision A5: such a habit is
 * "available" daily rather than pinned to particular weekdays. Whether it is
 * *needed* today is a separate question, answered by `paceStatus` — that
 * split is what keeps the app calm rather than naggy.
 */
export function isDueOn(schedule: Schedule, date: IsoDate): boolean {
  if (date < schedule.effectiveFrom) return false;
  if (schedule.effectiveTo !== null && date > schedule.effectiveTo) return false;

  switch (schedule.cadenceType) {
    case "DAILY":
      return true;

    case "WEEKDAYS":
      return schedule.weekdays.includes(parse(date).weekday);

    case "TIMES_PER_WEEK":
      return true;

    case "INTERVAL": {
      if (!schedule.anchorDate || !schedule.intervalDays) return false;
      if (date < schedule.anchorDate) return false;
      const elapsed = daysBetween(schedule.anchorDate, date);
      return elapsed % schedule.intervalDays === 0;
    }
  }
}

/** The inclusive [start, end] of the week containing `date`. */
export function weekBounds(
  date: IsoDate,
  weekStartsOn: number,
): { start: IsoDate; end: IsoDate } {
  const current = parse(date);
  const offset = (current.weekday - weekStartsOn + 7) % 7;
  const start = current.minus({ days: offset });
  return {
    start: start.toFormat(ISO),
    end: start.plus({ days: 6 }).toFormat(ISO),
  };
}

/**
 * Where an N-times-per-week habit stands (decision A5).
 *
 * It flips to NEEDED_TODAY only when the remaining completions equal the
 * remaining days — the point at which the target becomes unreachable if today
 * is skipped. Before that it stays AVAILABLE, which shows status without
 * scolding.
 */
export function paceStatus(
  schedule: Schedule,
  date: IsoDate,
  logsThisWeek: Log[],
  weekStartsOn: number,
): PaceStatus {
  if (schedule.cadenceType !== "TIMES_PER_WEEK" || !schedule.timesPerWeek) {
    return isCompleteOn(logsThisWeek, date, schedule) ? "MET" : "AVAILABLE";
  }

  const { end } = weekBounds(date, weekStartsOn);
  const done = logsThisWeek.filter((log) => isComplete(log, schedule)).length;
  const remaining = schedule.timesPerWeek - done;

  if (remaining <= 0) return "MET";

  // Inclusive of today: on the final day, one day is left, not zero.
  const daysLeft = daysBetween(date, end) + 1;
  return remaining >= daysLeft ? "NEEDED_TODAY" : "AVAILABLE";
}

/**
 * Whether a log counts as done.
 *
 * A COUNT habit is measured against the target captured on the log itself,
 * falling back to the schedule only when there is no snapshot. A value above
 * target still counts as complete — product spec §8 wants an overshoot to read
 * as ≥100%, not to be capped oddly.
 */
export function isComplete(log: Log, schedule: Schedule): boolean {
  if (log.status === "SKIPPED") return false;
  if (schedule.completionType === "BINARY") return true;

  const target = log.targetSnapshot ?? schedule.targetValue;
  if (!target) return false;
  return (log.value ?? 0) >= target;
}

/** Fractional progress for a log. Uncapped, so 120% renders as 120%. */
export function progressOf(log: Log, schedule: Schedule): number {
  if (log.status === "SKIPPED") return 0;
  if (schedule.completionType === "BINARY") return 1;

  const target = log.targetSnapshot ?? schedule.targetValue;
  if (!target) return 0;
  return (log.value ?? 0) / target;
}

function isCompleteOn(logs: Log[], date: IsoDate, schedule: Schedule): boolean {
  const log = logs.find((entry) => entry.logDate === date);
  return log ? isComplete(log, schedule) : false;
}

/**
 * Current and best streaks, walking backwards from `upToDate`.
 *
 * Three rules, each of which exists because of a specific requirement:
 *
 *  · A day the habit was not due is neutral — it neither extends nor breaks a
 *    streak. Otherwise every weekend would end a Mon–Fri habit's streak.
 *  · An explicitly SKIPPED day is also neutral. That is the whole point of
 *    recording skip separately from not-done (product spec §8).
 *  · A TIMES_PER_WEEK day only breaks a streak when the pace made it
 *    mandatory. A 4×/week habit should not be punished for resting on a day
 *    it was still on track to hit the target.
 *
 * Archiving mid-streak freezes rather than continues the streak: the caller
 * passes the archive date as `upToDate`, so days after it are never examined
 * (product spec §8).
 */
export function computeStreaks(
  logs: Log[],
  schedules: Schedule[],
  upToDate: IsoDate,
  weekStartsOn = 1,
): Streaks {
  if (schedules.length === 0) return { current: 0, best: 0 };

  const logsByDate = new Map(logs.map((log) => [log.logDate, log]));
  const earliest = schedules.reduce(
    (min, schedule) => (schedule.effectiveFrom < min ? schedule.effectiveFrom : min),
    schedules[0].effectiveFrom,
  );

  let current = 0;
  let best = 0;
  let run = 0;
  let currentClosed = false;

  for (let date = upToDate; date >= earliest; date = addDays(date, -1)) {
    const schedule = scheduleOn(schedules, date);
    if (!schedule) continue;
    if (!isDueOn(schedule, date)) continue;

    const log = logsByDate.get(date);

    if (log && isComplete(log, schedule)) {
      run += 1;
      if (!currentClosed) current = run;
      best = Math.max(best, run);
      continue;
    }

    if (log?.status === "SKIPPED") continue;

    if (schedule.cadenceType === "TIMES_PER_WEEK") {
      const { start, end } = weekBounds(date, weekStartsOn);
      const weekLogs = logs.filter(
        (entry) => entry.logDate >= start && entry.logDate <= end,
      );
      // Only a day the pace made mandatory can break the streak.
      if (paceStatus(schedule, date, weekLogs, weekStartsOn) !== "NEEDED_TODAY") {
        continue;
      }
    }

    // A genuine miss: the run ends, and the current streak is now fixed.
    run = 0;
    currentClosed = true;
  }

  return { current, best };
}

/**
 * Share of due days in [from, to] that were completed.
 *
 * Skipped days are excluded from both halves of the fraction rather than
 * counted as failures — a deliberate skip is not a miss.
 */
export function completionRate(
  logs: Log[],
  schedules: Schedule[],
  from: IsoDate,
  to: IsoDate,
): number {
  const logsByDate = new Map(logs.map((log) => [log.logDate, log]));
  let due = 0;
  let done = 0;

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const schedule = scheduleOn(schedules, date);
    if (!schedule || !isDueOn(schedule, date)) continue;

    const log = logsByDate.get(date);
    if (log?.status === "SKIPPED") continue;

    due += 1;
    if (log && isComplete(log, schedule)) done += 1;
  }

  return due === 0 ? 0 : done / due;
}

/** The dates a habit is due within a range — drives the history grid. */
export function dueDatesBetween(
  schedules: Schedule[],
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const schedule = scheduleOn(schedules, date);
    if (schedule && isDueOn(schedule, date)) dates.push(date);
  }
  return dates;
}

export { addDays, daysBetween };
