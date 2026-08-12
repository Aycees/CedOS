/**
 * Engine types.
 *
 * Deliberately plain and decoupled from Prisma: everything in `engine/` is
 * pure functions with no I/O, which is what makes them exhaustively testable
 * (system design §5). Dates are ISO calendar strings rather than Date objects
 * so that no zone can quietly enter the arithmetic.
 */

export type CadenceType = "DAILY" | "WEEKDAYS" | "TIMES_PER_WEEK" | "INTERVAL";
export type CompletionType = "BINARY" | "COUNT";
export type LogStatus = "LOGGED" | "SKIPPED";

/** ISO calendar date, e.g. "2026-08-11". */
export type IsoDate = string;

export type Schedule = {
  id: string;
  cadenceType: CadenceType;
  /** ISO weekdays 1–7; only meaningful when cadenceType is WEEKDAYS. */
  weekdays: number[];
  timesPerWeek: number | null;
  intervalDays: number | null;
  anchorDate: IsoDate | null;
  completionType: CompletionType;
  targetValue: number | null;
  unit: string | null;
  effectiveFrom: IsoDate;
  /** null = currently active. */
  effectiveTo: IsoDate | null;
};

export type Log = {
  logDate: IsoDate;
  status: LogStatus;
  value: number | null;
  /**
   * The target this log was measured against, captured at log time (A6).
   * Historical scoring reads this, never the live schedule — which is what
   * stops a retarget from recolouring old days as failures.
   */
  targetSnapshot: number | null;
};

export type PaceStatus = "AVAILABLE" | "NEEDED_TODAY" | "MET";

export type Streaks = { current: number; best: number };
