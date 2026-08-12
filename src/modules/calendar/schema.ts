import { z } from "zod";

/**
 * The wider 8-colour set covers calendar/category tags
 * (design-reference/readme.md — "Color"). Stored as a token key rather than a
 * hex value, so a category recolours correctly in both themes and never
 * hardcodes a literal.
 */
export const CATEGORY_COLORS = [
  "blue",
  "green",
  "terracotta",
  "violet",
  "red",
  "warmgray",
  "sky",
  "mauve",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date like 2026-08-11.");

/** null / "" means untimed — an all-day event (decision A2). */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.")
  .nullable();

export const createCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "A calendar needs a name.").max(80),
  color: z.enum(CATEGORY_COLORS),
});

export const updateCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "A calendar needs a name.").max(80).optional(),
  color: z.enum(CATEGORY_COLORS).optional(),
});

/**
 * Deleting a category is a three-mode operation because of decision A1.
 *
 * `check` is what the UI calls first; if the category owns events the service
 * refuses and the UI opens the impact preview. The user then picks one of the
 * two exits, which come back as `reassign` or `cascade`.
 */
export const deleteCategorySchema = z.object({
  id: z.uuid(),
  mode: z.enum(["check", "reassign", "cascade"]).default("check"),
  targetCategoryId: z.uuid().optional(),
});

export const createEventSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "An event needs a title.").max(300),
  eventDate: isoDate,
  startTime: timeOfDay.optional().default(null),
  /** Required — product spec §4 forbids uncategorised events. */
  categoryId: z.uuid("Pick a calendar for this event."),
  location: z.string().trim().max(300).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const updateEventSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "An event needs a title.").max(300).optional(),
  eventDate: isoDate.optional(),
  startTime: timeOfDay.optional(),
  categoryId: z.uuid().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const deleteEventSchema = z.object({ id: z.uuid() });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export type CategoryView = {
  id: string;
  name: string;
  color: CategoryColor;
  eventCount: number;
};

export type EventView = {
  id: string;
  title: string;
  eventDate: string;
  /** null = untimed. Rendered in the day cell's all-day band (A2). */
  startTime: string | null;
  categoryId: string;
  location: string | null;
  note: string | null;
  /** True when the event came from an itinerary push (A7). */
  fromItinerary: boolean;
};

export type CategoryImpact = {
  categoryName: string;
  events: { id: string; title: string; eventDate: string; startTime: string | null }[];
};
