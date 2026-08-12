import { z } from "zod";

import { CATEGORY_COLORS } from "@/modules/calendar/schema";

export const TIME_SLOTS = ["MORNING", "AFTERNOON", "EVENING", "ANYTIME"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const SLOT_LABELS: Record<TimeSlot, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  ANYTIME: "Anytime",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-11.");

/**
 * Cadence and completion travel together because they are validated together:
 * INTERVAL needs an anchor and a step, TIMES_PER_WEEK needs a count, COUNT
 * needs a target. The same rules exist as check constraints in the database —
 * this layer is what turns a violation into an inline message instead of a
 * 500.
 */
export const cadenceSchema = z
  .object({
    cadenceType: z.enum(["DAILY", "WEEKDAYS", "TIMES_PER_WEEK", "INTERVAL"]),
    weekdays: z.array(z.number().int().min(1).max(7)).default([]),
    timesPerWeek: z.number().int().min(1).max(7).nullable().default(null),
    intervalDays: z.number().int().min(1).max(365).nullable().default(null),
    anchorDate: isoDate.nullable().default(null),
    completionType: z.enum(["BINARY", "COUNT"]).default("BINARY"),
    targetValue: z.number().positive().nullable().default(null),
    unit: z.string().trim().max(30).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.cadenceType === "WEEKDAYS" && value.weekdays.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Pick at least one day.",
      });
    }
    if (value.cadenceType === "TIMES_PER_WEEK" && !value.timesPerWeek) {
      ctx.addIssue({
        code: "custom",
        path: ["timesPerWeek"],
        message: "How many times a week?",
      });
    }
    if (value.cadenceType === "INTERVAL" && (!value.intervalDays || !value.anchorDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalDays"],
        message: "An interval needs a step and a start date.",
      });
    }
    if (value.completionType === "COUNT" && !value.targetValue) {
      ctx.addIssue({
        code: "custom",
        path: ["targetValue"],
        message: "A measured habit needs a target.",
      });
    }
  });

export const createHabitSchema = z.object({
  id: z.uuid(),
  scheduleId: z.uuid(),
  name: z.string().trim().min(1, "A habit needs a name.").max(120),
  color: z.enum(CATEGORY_COLORS),
  timeSlot: z.enum(TIME_SLOTS).default("ANYTIME"),
  /** Today in the user's zone — the new schedule's effectiveFrom. */
  today: isoDate,
  cadence: cadenceSchema,
});

export const updateHabitSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  color: z.enum(CATEGORY_COLORS).optional(),
  timeSlot: z.enum(TIME_SLOTS).optional(),
  /**
   * Present only when cadence or target changed. Supplying it opens a NEW
   * schedule version rather than mutating the current one (decision A6) —
   * which is what keeps historical days scored against what they were
   * actually set to.
   */
  scheduleId: z.uuid().optional(),
  today: isoDate.optional(),
  cadence: cadenceSchema.optional(),
});

export const logHabitSchema = z.object({
  id: z.uuid(),
  habitId: z.uuid(),
  logDate: isoDate,
  status: z.enum(["LOGGED", "SKIPPED"]).default("LOGGED"),
  /** null for BINARY habits; the measured amount for COUNT ones. */
  value: z.number().nonnegative().nullable().default(null),
});

export const clearLogSchema = z.object({ habitId: z.uuid(), logDate: isoDate });

export const archiveHabitSchema = z.object({
  id: z.uuid(),
  archived: z.boolean(),
  today: isoDate,
});

export const deleteHabitSchema = z.object({ id: z.uuid() });

export type CadenceInput = z.infer<typeof cadenceSchema>;
export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type LogHabitInput = z.infer<typeof logHabitSchema>;

export type HabitTodayView = {
  id: string;
  name: string;
  color: string;
  timeSlot: TimeSlot;
  archivedAt: string | null;
  cadenceType: "DAILY" | "WEEKDAYS" | "TIMES_PER_WEEK" | "INTERVAL";
  cadenceLabel: string;
  completionType: "BINARY" | "COUNT";
  targetValue: number | null;
  unit: string | null;
  /** Today's log, if any. */
  status: "LOGGED" | "SKIPPED" | null;
  value: number | null;
  progress: number;
  pace: "AVAILABLE" | "NEEDED_TODAY" | "MET";
  currentStreak: number;
  bestStreak: number;
  /** Completion over the trailing 7 days. */
  weekRate: number;
};

export type HabitHistoryCell = {
  date: string;
  due: boolean;
  progress: number;
  status: "LOGGED" | "SKIPPED" | null;
};

export type HabitHistoryView = {
  id: string;
  name: string;
  color: string;
  cells: HabitHistoryCell[];
  currentStreak: number;
  bestStreak: number;
};

/** Human phrasing for a cadence, used in list rows. */
export function cadenceLabel(cadence: {
  cadenceType: string;
  weekdays: number[];
  timesPerWeek: number | null;
  intervalDays: number | null;
}): string {
  switch (cadence.cadenceType) {
    case "DAILY":
      return "every day";
    case "WEEKDAYS": {
      const names = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      return cadence.weekdays
        .slice()
        .sort((a, b) => a - b)
        .map((day) => names[day - 1])
        .join(" · ");
    }
    case "TIMES_PER_WEEK":
      return `${cadence.timesPerWeek}× a week`;
    case "INTERVAL":
      return cadence.intervalDays === 1
        ? "every day"
        : `every ${cadence.intervalDays} days`;
    default:
      return "";
  }
}
