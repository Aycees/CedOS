import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import {
  completionRate,
  computeStreaks,
  isComplete,
  isDueOn,
  paceStatus,
  progressOf,
  scheduleOn,
  weekBounds,
} from "./cadence";
import type { Log, Schedule } from "./types";

/**
 * System design §5.1 lists the test cases that must exist, because they are
 * "where this class of code actually breaks". Each is covered below.
 */

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    cadenceType: "DAILY",
    weekdays: [],
    timesPerWeek: null,
    intervalDays: null,
    anchorDate: null,
    completionType: "BINARY",
    targetValue: null,
    unit: null,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    ...overrides,
  };
}

function log(logDate: string, overrides: Partial<Log> = {}): Log {
  return { logDate, status: "LOGGED", value: null, targetSnapshot: null, ...overrides };
}

describe("INTERVAL cadence across month and year boundaries", () => {
  const everyTwoDays = schedule({
    cadenceType: "INTERVAL",
    intervalDays: 2,
    anchorDate: "2026-02-27",
    effectiveFrom: "2026-02-27",
  });

  it("crosses into March correctly in a non-leap year", () => {
    // 2026 is not a leap year: Feb 27 → Mar 1 is two days.
    expect(isDueOn(everyTwoDays, "2026-02-27")).toBe(true);
    expect(isDueOn(everyTwoDays, "2026-02-28")).toBe(false);
    expect(isDueOn(everyTwoDays, "2026-03-01")).toBe(true);
    expect(isDueOn(everyTwoDays, "2026-03-03")).toBe(true);
  });

  it("crosses into March correctly in a leap year", () => {
    // 2028 is a leap year, so Feb 29 exists and the parity shifts.
    const leap = schedule({
      cadenceType: "INTERVAL",
      intervalDays: 2,
      anchorDate: "2028-02-27",
      effectiveFrom: "2028-02-27",
    });
    expect(isDueOn(leap, "2028-02-27")).toBe(true);
    expect(isDueOn(leap, "2028-02-29")).toBe(true);
    expect(isDueOn(leap, "2028-03-01")).toBe(false);
    expect(isDueOn(leap, "2028-03-02")).toBe(true);
  });

  it("crosses a year boundary without drifting", () => {
    const yearEnd = schedule({
      cadenceType: "INTERVAL",
      intervalDays: 3,
      anchorDate: "2026-12-28",
      effectiveFrom: "2026-12-28",
    });
    expect(isDueOn(yearEnd, "2026-12-31")).toBe(true);
    expect(isDueOn(yearEnd, "2027-01-03")).toBe(true);
    expect(isDueOn(yearEnd, "2027-01-04")).toBe(false);
  });

  it("is not due before its anchor", () => {
    expect(isDueOn(everyTwoDays, "2026-02-25")).toBe(false);
  });
});

describe("INTERVAL cadence is immune to DST", () => {
  it("steps by whole calendar days across a spring-forward boundary", () => {
    // America/New_York springs forward on 2026-03-08. A naive
    // millisecond-based step lands on the wrong day here; whole calendar-date
    // arithmetic does not. Asia/Manila has no DST, but `timezone` is
    // user-editable, so this must hold anyway (system design §5.1).
    const daily = schedule({
      cadenceType: "INTERVAL",
      intervalDays: 1,
      anchorDate: "2026-03-06",
      effectiveFrom: "2026-03-06",
    });

    for (const date of ["2026-03-07", "2026-03-08", "2026-03-09"]) {
      expect(isDueOn(daily, date)).toBe(true);
    }

    const everyTwo = schedule({
      cadenceType: "INTERVAL",
      intervalDays: 2,
      anchorDate: "2026-03-06",
      effectiveFrom: "2026-03-06",
    });
    expect(isDueOn(everyTwo, "2026-03-08")).toBe(true);
    expect(isDueOn(everyTwo, "2026-03-09")).toBe(false);

    // Sanity: the boundary genuinely is a DST transition in that zone.
    const before = DateTime.fromISO("2026-03-07T12:00", { zone: "America/New_York" });
    const after = DateTime.fromISO("2026-03-09T12:00", { zone: "America/New_York" });
    expect(before.offset).not.toBe(after.offset);
  });
});

describe("WEEKDAYS cadence", () => {
  const weekdaysOnly = schedule({ cadenceType: "WEEKDAYS", weekdays: [1, 2, 3, 4, 5] });

  it("is not due at the weekend", () => {
    // 2026-08-15 is a Saturday, 2026-08-16 a Sunday.
    expect(isDueOn(weekdaysOnly, "2026-08-14")).toBe(true);
    expect(isDueOn(weekdaysOnly, "2026-08-15")).toBe(false);
    expect(isDueOn(weekdaysOnly, "2026-08-16")).toBe(false);
    expect(isDueOn(weekdaysOnly, "2026-08-17")).toBe(true);
  });

  it("does not break a streak by resting at the weekend", () => {
    const logs = [log("2026-08-13"), log("2026-08-14"), log("2026-08-17")];
    // Mon the 17th, plus Thu and Fri before it — the weekend is neutral.
    expect(computeStreaks(logs, [weekdaysOnly], "2026-08-17").current).toBe(3);
  });
});

describe("TIMES_PER_WEEK pace (decision A5)", () => {
  const fourPerWeek = schedule({
    cadenceType: "TIMES_PER_WEEK",
    timesPerWeek: 4,
    effectiveFrom: "2026-08-01",
  });

  it("is available every day rather than pinned to weekdays", () => {
    expect(isDueOn(fourPerWeek, "2026-08-11")).toBe(true);
    expect(isDueOn(fourPerWeek, "2026-08-15")).toBe(true);
  });

  it("flips to NEEDED_TODAY exactly at the pace boundary", () => {
    // Week starts Monday 2026-08-10, so Sunday the 16th is the last day.
    // 4×/week, 3 done, 1 day left → the target is unreachable if skipped.
    const done = [log("2026-08-10"), log("2026-08-11"), log("2026-08-12")];
    expect(paceStatus(fourPerWeek, "2026-08-16", done, 1)).toBe("NEEDED_TODAY");
  });

  it("stays AVAILABLE while the target is still reachable", () => {
    const done = [log("2026-08-10"), log("2026-08-11"), log("2026-08-12")];
    // Two days left, one completion needed — no need to scold.
    expect(paceStatus(fourPerWeek, "2026-08-15", done, 1)).toBe("AVAILABLE");
  });

  it("reports MET once the weekly target is reached", () => {
    const done = [
      log("2026-08-10"),
      log("2026-08-11"),
      log("2026-08-12"),
      log("2026-08-13"),
    ];
    expect(paceStatus(fourPerWeek, "2026-08-14", done, 1)).toBe("MET");
  });

  it("respects a Sunday week start", () => {
    // With weeks starting Sunday, 2026-08-16 opens a new week rather than
    // closing one — the setting decision A5 introduced genuinely matters.
    expect(weekBounds("2026-08-16", 7)).toEqual({
      start: "2026-08-16",
      end: "2026-08-22",
    });
    expect(weekBounds("2026-08-16", 1)).toEqual({
      start: "2026-08-10",
      end: "2026-08-16",
    });
  });

  it("does not break a streak on a rest day that was still on pace", () => {
    const logs = [log("2026-08-10"), log("2026-08-11"), log("2026-08-12")];
    // The 13th has no log, but three of four are already done with days to
    // spare, so it was never mandatory.
    expect(computeStreaks(logs, [fourPerWeek], "2026-08-13").current).toBe(3);
  });
});

describe("schedule versioning (decision A6)", () => {
  const daily = schedule({
    id: "v1",
    cadenceType: "DAILY",
    effectiveFrom: "2026-08-01",
    effectiveTo: "2026-08-10",
  });
  const threePerWeek = schedule({
    id: "v2",
    cadenceType: "TIMES_PER_WEEK",
    timesPerWeek: 3,
    effectiveFrom: "2026-08-11",
    effectiveTo: null,
  });

  it("picks the version in effect on each date", () => {
    expect(scheduleOn([daily, threePerWeek], "2026-08-05")?.id).toBe("v1");
    expect(scheduleOn([daily, threePerWeek], "2026-08-11")?.id).toBe("v2");
    expect(scheduleOn([daily, threePerWeek], "2026-07-31")).toBeNull();
  });

  it("carries a streak across a cadence change", () => {
    const logs = [
      log("2026-08-08"),
      log("2026-08-09"),
      log("2026-08-10"),
      log("2026-08-11"),
      log("2026-08-12"),
    ];
    // Five consecutive completions spanning the daily → 3×/week switch.
    expect(computeStreaks(logs, [daily, threePerWeek], "2026-08-12").current).toBe(5);
  });

  it("scores an old log against the target it was set at the time", () => {
    // Product spec §8: a habit retargeted from 20 to 30 pages must not
    // recolour old 20-page days as failures.
    const retargeted = schedule({ completionType: "COUNT", targetValue: 30 });
    const oldLog = log("2026-08-01", { value: 20, targetSnapshot: 20 });
    expect(isComplete(oldLog, retargeted)).toBe(true);
  });
});

describe("skip is not the same as not-done (product spec §8)", () => {
  const daily = schedule({ effectiveFrom: "2026-08-01" });

  it("treats a skipped day as neutral rather than a miss", () => {
    const logs = [
      log("2026-08-10"),
      log("2026-08-11", { status: "SKIPPED" }),
      log("2026-08-12"),
    ];
    expect(computeStreaks(logs, [daily], "2026-08-12").current).toBe(2);
  });

  it("breaks a streak on a day with no log at all", () => {
    const logs = [log("2026-08-10"), log("2026-08-12")];
    expect(computeStreaks(logs, [daily], "2026-08-12").current).toBe(1);
  });

  it("excludes skipped days from the completion rate entirely", () => {
    const logs = [log("2026-08-01"), log("2026-08-02", { status: "SKIPPED" })];
    // One due day, one completion — the skip is not a failure.
    expect(completionRate(logs, [daily], "2026-08-01", "2026-08-02")).toBe(1);
  });
});

describe("archiving freezes a streak (product spec §8)", () => {
  it("stops counting at the archive date instead of continuing or erasing", () => {
    const daily = schedule({ effectiveFrom: "2026-08-01" });
    const logs = [log("2026-08-08"), log("2026-08-09"), log("2026-08-10")];

    // Archived on the 10th: the days after it are never examined, so the
    // streak reads 3 rather than decaying to 0 as unlogged days accumulate.
    expect(computeStreaks(logs, [daily], "2026-08-10").current).toBe(3);
    expect(computeStreaks(logs, [daily], "2026-08-20").current).toBe(0);
    expect(computeStreaks(logs, [daily], "2026-08-20").best).toBe(3);
  });
});

describe("COUNT habits", () => {
  const eightGlasses = schedule({
    completionType: "COUNT",
    targetValue: 8,
    unit: "glasses",
  });

  it("counts an overshoot as complete and reports above 100%", () => {
    const over = log("2026-08-11", { value: 10, targetSnapshot: 8 });
    expect(isComplete(over, eightGlasses)).toBe(true);
    expect(progressOf(over, eightGlasses)).toBeCloseTo(1.25);
  });

  it("gives partial credit without marking the day done", () => {
    const partial = log("2026-08-11", { value: 4, targetSnapshot: 8 });
    expect(isComplete(partial, eightGlasses)).toBe(false);
    expect(progressOf(partial, eightGlasses)).toBeCloseTo(0.5);
  });
});

describe("completion rate", () => {
  it("counts only days the habit was actually due", () => {
    const weekdaysOnly = schedule({
      cadenceType: "WEEKDAYS",
      weekdays: [1, 2, 3, 4, 5],
      effectiveFrom: "2026-08-10",
    });
    // Mon–Sun: five due days, four logged.
    const logs = [
      log("2026-08-10"),
      log("2026-08-11"),
      log("2026-08-12"),
      log("2026-08-13"),
    ];
    expect(completionRate(logs, [weekdaysOnly], "2026-08-10", "2026-08-16")).toBeCloseTo(
      0.8,
    );
  });

  it("returns zero rather than dividing by zero when nothing was due", () => {
    const weekdaysOnly = schedule({ cadenceType: "WEEKDAYS", weekdays: [1] });
    expect(completionRate([], [weekdaysOnly], "2026-08-15", "2026-08-16")).toBe(0);
  });
});
