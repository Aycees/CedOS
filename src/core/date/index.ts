import { DateTime } from "luxon";

/**
 * Date handling.
 *
 * Two rules from the planning documents, both load-bearing:
 *
 *  1. Calendar dates (event dates, journal dates, habit log dates) are plain
 *     dates with no time and no zone. Only true instants use timestamptz.
 *     This is what stops an untimed event from becoming 00:00 UTC and
 *     sorting first for the wrong reason (decision A2).
 *
 *  2. "Today" is always computed in the user's own timezone — never the
 *     server's, never the browser's (system design §5.1). That is why
 *     `Profile.timezone` is required rather than optional, and why every
 *     function here takes the zone explicitly instead of reading ambient
 *     state.
 */

/** ISO calendar date, e.g. "2026-08-11". The wire format for @db.Date columns. */
export type IsoDate = string;

export const ISO_DATE = "yyyy-MM-dd";

/** The user's today, as a calendar date. */
export function today(timezone: string): DateTime {
  return DateTime.now().setZone(timezone).startOf("day");
}

export function todayIso(timezone: string): IsoDate {
  return today(timezone).toFormat(ISO_DATE);
}

/**
 * Converts a `@db.Date` column to an ISO date string.
 *
 * Prisma hands back a JS Date pinned to UTC midnight for date columns. Reading
 * it with local getters shifts the day backwards for anyone west of UTC, so
 * this reads the UTC components deliberately.
 */
export function dbDateToIso(value: Date): IsoDate {
  return DateTime.fromJSDate(value, { zone: "utc" }).toFormat(ISO_DATE);
}

/**
 * Converts an ISO date string to the UTC-midnight Date a `@db.Date` column
 * expects. The zone is UTC on purpose — this value carries no time, and
 * anchoring it anywhere else reintroduces the off-by-one-day bug.
 */
export function isoToDbDate(value: IsoDate): Date {
  const parsed = DateTime.fromFormat(value, ISO_DATE, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Not an ISO calendar date: ${value}`);
  }
  return parsed.toJSDate();
}

/**
 * Converts "HH:mm" to the Date a `@db.Time(0)` column expects.
 *
 * Anchored to the UTC epoch day for the same reason calendar dates are: the
 * value carries no date and no zone, and letting a local zone touch it would
 * shift the clock time.
 */
export function timeToDb(value: string): Date {
  const parsed = DateTime.fromFormat(value, "HH:mm", { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Not a time of day: ${value}`);
  }
  return parsed.set({ year: 1970, month: 1, day: 1 }).toJSDate();
}

/** Parses a `@db.Time(0)` column ("HH:mm:ss") into minutes since midnight, for sorting. */
export function timeToMinutes(value: Date | null): number | null {
  if (!value) return null;
  const t = DateTime.fromJSDate(value, { zone: "utc" });
  return t.hour * 60 + t.minute;
}

/** Formats a `@db.Time(0)` column for display, e.g. "09:30". Null renders as "". */
export function formatTime(value: Date | null): string {
  if (!value) return "";
  return DateTime.fromJSDate(value, { zone: "utc" }).toFormat("HH:mm");
}

/** "SATURDAY, AUGUST 8" — the page-header kicker format from the mockup. */
export function formatHeaderDate(date: DateTime): string {
  return date.toFormat("cccc, LLLL d").toUpperCase();
}

/** "SAT · AUG 8" — the compact sidebar format. */
export function formatSidebarDate(date: DateTime): string {
  return date.toFormat("ccc · LLL d").toUpperCase();
}

/** "AUG 11, 2026" — list metadata. */
export function formatListDate(iso: IsoDate): string {
  return DateTime.fromFormat(iso, ISO_DATE, { zone: "utc" })
    .toFormat("LLL d, yyyy")
    .toUpperCase();
}

/** "AUG 11" — compact card metadata, no year. */
export function formatShortDate(iso: IsoDate): string {
  return DateTime.fromFormat(iso, ISO_DATE, { zone: "utc" })
    .toFormat("LLL d")
    .toUpperCase();
}

/**
 * Age derived from a birthday, never stored (product spec §12.1) so it cannot
 * go stale. Null when the birthday is unset — the caller shows
 * "Birthday not set" rather than a zero.
 */
export function ageFrom(birthday: IsoDate | null, timezone: string): number | null {
  if (!birthday) return null;
  const born = DateTime.fromFormat(birthday, ISO_DATE, { zone: timezone });
  if (!born.isValid) return null;
  const years = today(timezone).diff(born.startOf("day"), "years").years;
  return years < 0 ? null : Math.floor(years);
}

/**
 * Whether a completion timestamp is older than `days` (default 7).
 *
 * Decision A3: completed tasks stay visible but collapse behind a
 * "show completed" toggle after a week. Comparison happens in the user's
 * zone so the boundary falls at their midnight, not UTC's.
 */
export function isOlderThanDays(
  instant: Date,
  timezone: string,
  days = 7,
): boolean {
  const then = DateTime.fromJSDate(instant).setZone(timezone).startOf("day");
  return today(timezone).diff(then, "days").days >= days;
}
