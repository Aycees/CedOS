import { Settings } from "luxon";
import { afterEach, describe, expect, it } from "vitest";

import {
  ageFrom,
  dbDateToIso,
  formatTime,
  isOlderThanDays,
  isoToDbDate,
  timeToMinutes,
  todayIso,
} from ".";

/**
 * These tests exist because date handling is where this app is most likely to
 * be quietly wrong: the failures do not throw, they just show the wrong day.
 */

afterEach(() => {
  Settings.now = () => Date.now();
});

/** Pins "now" so the assertions are about the logic, not about today. */
function freeze(iso: string) {
  const fixed = new Date(iso).valueOf();
  Settings.now = () => fixed;
}

describe("calendar dates round-trip without shifting", () => {
  it("survives a date column read in a zone behind UTC", () => {
    // The classic bug: Prisma returns UTC midnight for a @db.Date column, and
    // reading it with local getters in a western zone lands on the day before.
    const stored = isoToDbDate("2026-08-11");
    expect(stored.toISOString()).toBe("2026-08-11T00:00:00.000Z");
    expect(dbDateToIso(stored)).toBe("2026-08-11");
  });

  it("round-trips a leap day", () => {
    expect(dbDateToIso(isoToDbDate("2028-02-29"))).toBe("2028-02-29");
  });

  it("rejects a value that is not a calendar date", () => {
    expect(() => isoToDbDate("11/08/2026")).toThrow();
  });
});

describe("today is the user's today, never the server's", () => {
  it("differs across zones at the same instant", () => {
    // 2026-08-11 20:00 UTC — already the 12th in Manila, still the 11th in NY.
    freeze("2026-08-11T20:00:00.000Z");
    expect(todayIso("Asia/Manila")).toBe("2026-08-12");
    expect(todayIso("America/New_York")).toBe("2026-08-11");
  });
});

describe("untimed values sort separately rather than as midnight (A2)", () => {
  it("returns null minutes for an untimed value", () => {
    // The whole point of decision A2: an untimed event must be distinguishable
    // from one at 00:00, not collapsed into it.
    expect(timeToMinutes(null)).toBeNull();
    expect(formatTime(null)).toBe("");
  });

  it("reads a time column without applying a zone offset", () => {
    const nineThirty = new Date("1970-01-01T09:30:00.000Z");
    expect(timeToMinutes(nineThirty)).toBe(570);
    expect(formatTime(nineThirty)).toBe("09:30");
  });
});

describe("age is derived, never stored (product spec §12.1)", () => {
  it("does not count a birthday that has not happened yet this year", () => {
    freeze("2026-08-11T04:00:00.000Z");
    expect(ageFrom("1999-08-12", "Asia/Manila")).toBe(26);
    expect(ageFrom("1999-08-10", "Asia/Manila")).toBe(27);
  });

  it("returns null when the birthday is unset, so the UI can say so", () => {
    expect(ageFrom(null, "Asia/Manila")).toBeNull();
  });
});

describe("completed tasks collapse after 7 days (A3)", () => {
  it("keeps a task completed today expanded", () => {
    freeze("2026-08-11T04:00:00.000Z");
    const justNow = new Date("2026-08-11T03:00:00.000Z");
    expect(isOlderThanDays(justNow, "Asia/Manila")).toBe(false);
  });

  it("collapses on the seventh day, not the eighth", () => {
    freeze("2026-08-11T04:00:00.000Z");
    const sevenDaysAgo = new Date("2026-08-04T03:00:00.000Z");
    const sixDaysAgo = new Date("2026-08-05T03:00:00.000Z");
    expect(isOlderThanDays(sevenDaysAgo, "Asia/Manila")).toBe(true);
    expect(isOlderThanDays(sixDaysAgo, "Asia/Manila")).toBe(false);
  });
});
