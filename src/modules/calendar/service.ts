import "server-only";

import { DateTime } from "luxon";

import { dbDateToIso, formatTime, isoToDbDate, timeToDb } from "@/core/date";
import { prisma } from "@/core/db/client";
import { assertOwned, live, softDeleted } from "@/core/db/scope";
import { AppError } from "@/core/errors";

import type {
  CategoryColor,
  CategoryImpact,
  CategoryView,
  CreateCategoryInput,
  CreateEventInput,
  DeleteCategoryInput,
  EventView,
  UpdateCategoryInput,
  UpdateEventInput,
} from "./schema";

/** The only place in this module that touches Prisma (decision log §7). */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(userId: string): Promise<CategoryView[]> {
  const categories = await prisma.calendarCategory.findMany({
    where: live(userId),
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { events: { where: { deletedAt: null } } } },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color as CategoryColor,
    eventCount: category._count.events,
  }));
}

export async function createCategory(userId: string, input: CreateCategoryInput) {
  await assertNameFree(userId, input.name);

  return prisma.calendarCategory.create({
    data: { id: input.id, userId, name: input.name, color: input.color },
  });
}

export async function updateCategory(userId: string, input: UpdateCategoryInput) {
  const existing = await prisma.calendarCategory.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "calendar");

  if (input.name && input.name.toLowerCase() !== existing!.name.toLowerCase()) {
    await assertNameFree(userId, input.name);
  }

  /*
   * Renaming or recolouring updates every existing event's display
   * immediately, with no backfill — colour and label are a lookup through the
   * FK, never copied onto the event (product spec §4).
   */
  return prisma.calendarCategory.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
  });
}

/**
 * What the impact-preview dialog renders (decision A1).
 *
 * Ordered date-descending because recent events are the ones a user
 * recognises and cares about; the long tail of old ones is what they are
 * willing to lose. The dialog truncates at 10 — but the full list comes back,
 * so "and N more" can expand without a second round-trip.
 */
export async function getCategoryImpact(
  userId: string,
  categoryId: string,
): Promise<CategoryImpact> {
  const category = await prisma.calendarCategory.findUnique({
    where: { id: categoryId },
  });
  assertOwned(category, userId, "calendar");

  const events = await prisma.calendarEvent.findMany({
    where: live(userId, { categoryId }),
    orderBy: [{ eventDate: "desc" }, { startTime: "desc" }],
  });

  return {
    categoryName: category!.name,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      eventDate: dbDateToIso(event.eventDate),
      startTime: event.startTime ? formatTime(event.startTime) : null,
    })),
  };
}

/**
 * Decision A1: the database refuses to delete a category that owns events
 * (`onDelete: Restrict`), and this is what turns that refusal into a useful
 * choice rather than an error message.
 *
 * `check` throws REFERENCED so the UI knows to open the preview. The two
 * exits then arrive as `reassign` (default, non-destructive) or `cascade`.
 */
export async function deleteCategory(userId: string, input: DeleteCategoryInput) {
  const category = await prisma.calendarCategory.findUnique({ where: { id: input.id } });
  assertOwned(category, userId, "calendar");

  const eventCount = await prisma.calendarEvent.count({
    where: live(userId, { categoryId: input.id }),
  });

  // A category with zero events deletes on a simple confirm, no preview.
  if (eventCount === 0) {
    await prisma.calendarCategory.update({
      where: { id: input.id },
      data: softDeleted(),
    });
    return { deleted: true, eventCount: 0 };
  }

  if (input.mode === "check") {
    throw new AppError(
      "REFERENCED",
      `${eventCount} ${eventCount === 1 ? "event is" : "events are"} on this calendar.`,
    );
  }

  if (input.mode === "reassign") {
    if (!input.targetCategoryId || input.targetCategoryId === input.id) {
      throw new AppError("VALIDATION_ERROR", "Choose a calendar to move these events to.");
    }
    const target = await prisma.calendarCategory.findUnique({
      where: { id: input.targetCategoryId },
    });
    assertOwned(target, userId, "calendar");

    // One transaction: a half-moved category would leave events pointing at a
    // deleted row, which is exactly what Restrict exists to prevent.
    await prisma.$transaction([
      prisma.calendarEvent.updateMany({
        where: { userId, categoryId: input.id, deletedAt: null },
        data: { categoryId: input.targetCategoryId },
      }),
      prisma.calendarCategory.update({ where: { id: input.id }, data: softDeleted() }),
    ]);

    return { deleted: true, movedEvents: eventCount };
  }

  // cascade — soft-delete the events alongside the category, so both remain
  // recoverable rather than being erased.
  await prisma.$transaction([
    prisma.calendarEvent.updateMany({
      where: { userId, categoryId: input.id, deletedAt: null },
      data: softDeleted(),
    }),
    prisma.calendarCategory.update({ where: { id: input.id }, data: softDeleted() }),
  ]);

  return { deleted: true, deletedEvents: eventCount };
}

/**
 * Enforces product spec §9's case-insensitive duplicate rule at the app layer
 * so the user gets an inline message rather than a database error. The partial
 * unique index in the migration is the backstop underneath it.
 */
async function assertNameFree(userId: string, name: string) {
  const clash = await prisma.calendarCategory.findFirst({
    where: live(userId, { name: { equals: name, mode: "insensitive" as const } }),
  });
  if (clash) {
    throw new AppError("CONFLICT", `You already have a calendar called "${clash.name}".`, {
      name: ["That name is already taken."],
    });
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Every event overlapping the given month, for the grid. */
export async function listEventsInMonth(
  userId: string,
  month: string,
  timezone: string,
): Promise<EventView[]> {
  const start = DateTime.fromFormat(month, "yyyy-MM", { zone: timezone });
  if (!start.isValid) {
    throw new AppError("VALIDATION_ERROR", "That is not a month.");
  }

  // The grid shows leading and trailing days from the neighbouring months, so
  // the query spans them rather than the calendar month alone.
  const from = start.startOf("month").minus({ days: 7 });
  const to = start.endOf("month").plus({ days: 7 });

  const events = await prisma.calendarEvent.findMany({
    where: live(userId, {
      eventDate: {
        gte: isoToDbDate(from.toFormat("yyyy-MM-dd")),
        lte: isoToDbDate(to.toFormat("yyyy-MM-dd")),
      },
    }),
    orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
  });

  return events.map(toEventView);
}

export async function listEventsOnDate(
  userId: string,
  isoDate: string,
): Promise<EventView[]> {
  const events = await prisma.calendarEvent.findMany({
    where: live(userId, { eventDate: isoToDbDate(isoDate) }),
    orderBy: [{ startTime: "asc" }],
  });
  return events.map(toEventView);
}

export async function createEvent(userId: string, input: CreateEventInput) {
  const category = await prisma.calendarCategory.findUnique({
    where: { id: input.categoryId },
  });
  assertOwned(category, userId, "calendar");

  return prisma.calendarEvent.create({
    data: {
      id: input.id,
      userId,
      title: input.title,
      eventDate: isoToDbDate(input.eventDate),
      startTime: input.startTime ? timeToDb(input.startTime) : null,
      categoryId: input.categoryId,
      location: input.location ?? null,
      note: input.note ?? null,
    },
  });
}

export async function updateEvent(userId: string, input: UpdateEventInput) {
  const existing = await prisma.calendarEvent.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "event");

  if (input.categoryId) {
    const category = await prisma.calendarCategory.findUnique({
      where: { id: input.categoryId },
    });
    assertOwned(category, userId, "calendar");
  }

  return prisma.calendarEvent.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.eventDate !== undefined
        ? { eventDate: isoToDbDate(input.eventDate) }
        : {}),
      ...(input.startTime !== undefined
        ? { startTime: input.startTime ? timeToDb(input.startTime) : null }
        : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
}

export async function deleteEvent(userId: string, id: string) {
  const existing = await prisma.calendarEvent.findUnique({ where: { id } });
  assertOwned(existing, userId, "event");

  await prisma.calendarEvent.update({ where: { id }, data: softDeleted() });
}

/** Today's events, time-sorted, for the Home rollup (product spec §3). */
export async function listTodayEvents(
  userId: string,
  timezone: string,
): Promise<EventView[]> {
  const today = DateTime.now().setZone(timezone).toFormat("yyyy-MM-dd");
  return listEventsOnDate(userId, today);
}

export async function countTodayEvents(
  userId: string,
  timezone: string,
): Promise<number> {
  const today = DateTime.now().setZone(timezone).toFormat("yyyy-MM-dd");
  return prisma.calendarEvent.count({
    where: live(userId, { eventDate: isoToDbDate(today) }),
  });
}

type EventRow = {
  id: string;
  title: string;
  eventDate: Date;
  startTime: Date | null;
  categoryId: string;
  location: string | null;
  note: string | null;
  sourceStopId: string | null;
};

function toEventView(event: EventRow): EventView {
  return {
    id: event.id,
    title: event.title,
    eventDate: dbDateToIso(event.eventDate),
    startTime: event.startTime ? formatTime(event.startTime) : null,
    categoryId: event.categoryId,
    location: event.location,
    note: event.note,
    fromItinerary: event.sourceStopId !== null,
  };
}
