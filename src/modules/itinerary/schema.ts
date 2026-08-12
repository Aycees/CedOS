import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-12.");
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.")
  .nullable();

export const createTripSchema = z
  .object({
    id: z.uuid(),
    placeName: z.string().trim().min(1, "Where to?").max(120),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "The trip cannot end before it starts.",
  });

export const updateTripSchema = z
  .object({
    id: z.uuid(),
    placeName: z.string().trim().min(1).max(120).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    { path: ["endDate"], message: "The trip cannot end before it starts." },
  );

export const deleteTripSchema = z.object({ id: z.uuid() });

export const createStopSchema = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  /** A8: an absolute date. "Day 2" is derived from it. */
  stopDate: isoDate,
  /** null = untimed, e.g. "decide the night before". */
  startTime: timeOfDay.optional().default(null),
  activity: z.string().trim().min(1, "What's the plan?").max(300),
  location: z.string().trim().max(300).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const updateStopSchema = z.object({
  id: z.uuid(),
  stopDate: isoDate.optional(),
  startTime: timeOfDay.optional(),
  activity: z.string().trim().min(1).max(300).optional(),
  location: z.string().trim().max(300).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const deleteStopSchema = z.object({ id: z.uuid() });

/** `preview` returns the plan without applying it; `apply` commits it. */
export const pushSchema = z.object({
  tripId: z.uuid(),
  mode: z.enum(["preview", "apply"]).default("preview"),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateStopInput = z.infer<typeof createStopSchema>;
export type UpdateStopInput = z.infer<typeof updateStopSchema>;

export type StopView = {
  id: string;
  stopDate: string;
  startTime: string | null;
  activity: string;
  location: string | null;
  note: string | null;
  sortOrder: number;
  pushedEventId: string | null;
};

export type TripView = {
  id: string;
  placeName: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  stopCount: number;
};

export type TripDetailView = TripView & {
  days: { dayIndex: number; date: string; stops: StopView[] }[];
  /** Stops left outside the trip's dates after it was shortened (A8). */
  outside: StopView[];
};

export type PushPreview = {
  create: number;
  update: number;
  orphan: number;
  unchanged: number;
  /** Set when the user has no Travel calendar yet — the push is blocked. */
  blocked?: "NO_TRAVEL_CATEGORY";
};
