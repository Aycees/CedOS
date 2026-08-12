import "server-only";

import { dbDateToIso, formatTime, isoToDbDate, timeToDb } from "@/core/date";
import { prisma } from "@/core/db/client";
import { assertOwned, live, softDeleted } from "@/core/db/scope";
import { AppError } from "@/core/errors";
import { newId } from "@/core/ids";

import {
  groupByDay,
  planPush,
  tripLength,
  type PushedEvent,
  type Stop,
  type Trip,
} from "./engine/sync";
import type {
  CreateStopInput,
  CreateTripInput,
  PushPreview,
  StopView,
  TripDetailView,
  TripView,
  UpdateStopInput,
  UpdateTripInput,
} from "./schema";

/** The only place in this module that touches Prisma (decision log §7). */

/** The calendar a push writes into (system design §5.2). */
const TRAVEL_CATEGORY_NAME = "Travel";

export async function listTrips(userId: string): Promise<TripView[]> {
  const trips = await prisma.trip.findMany({
    where: live(userId),
    orderBy: { startDate: "desc" },
    include: { _count: { select: { stops: { where: { deletedAt: null } } } } },
  });

  return trips.map((trip) => {
    const view = toTrip(trip);
    return {
      ...view,
      dayCount: tripLength(view),
      stopCount: trip._count.stops,
    };
  });
}

export async function getTrip(
  userId: string,
  tripId: string,
): Promise<TripDetailView> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { stops: { include: { pushedEvent: true } } },
  });
  assertOwned(trip, userId, "trip");

  const view = toTrip(trip!);
  const stops = trip!.stops.map(toStopModel);
  const { days, outside } = groupByDay(view, stops);

  const byId = new Map(trip!.stops.map((stop) => [stop.id, stop]));
  const toView = (stop: Stop): StopView => ({
    id: stop.id,
    stopDate: stop.stopDate,
    startTime: stop.startTime,
    activity: stop.activity,
    location: stop.location,
    note: stop.note,
    sortOrder: stop.sortOrder,
    pushedEventId: byId.get(stop.id)?.pushedEvent?.id ?? null,
  });

  return {
    ...view,
    dayCount: tripLength(view),
    stopCount: stops.filter((stop) => !stop.deleted).length,
    days: days.map((day) => ({ ...day, stops: day.stops.map(toView) })),
    outside: outside.map(toView),
  };
}

export async function createTrip(userId: string, input: CreateTripInput) {
  return prisma.trip.create({
    data: {
      id: input.id,
      userId,
      placeName: input.placeName,
      startDate: isoToDbDate(input.startDate),
      endDate: isoToDbDate(input.endDate),
    },
  });
}

/**
 * Editing trip dates never touches the stops.
 *
 * A8 stores an absolute date per stop, so shortening a trip leaves any
 * now-out-of-range stops visible in an "outside trip dates" bucket rather
 * than silently deleting or ambiguously remapping them.
 */
export async function updateTrip(userId: string, input: UpdateTripInput) {
  const existing = await prisma.trip.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "trip");

  return prisma.trip.update({
    where: { id: input.id },
    data: {
      ...(input.placeName !== undefined ? { placeName: input.placeName } : {}),
      ...(input.startDate !== undefined
        ? { startDate: isoToDbDate(input.startDate) }
        : {}),
      ...(input.endDate !== undefined ? { endDate: isoToDbDate(input.endDate) } : {}),
    },
  });
}

export async function deleteTrip(userId: string, id: string) {
  const existing = await prisma.trip.findUnique({ where: { id } });
  assertOwned(existing, userId, "trip");

  await prisma.$transaction([
    prisma.itineraryStop.updateMany({
      where: { userId, tripId: id, deletedAt: null },
      data: softDeleted(),
    }),
    prisma.trip.update({ where: { id }, data: softDeleted() }),
  ]);
}

export async function createStop(userId: string, input: CreateStopInput) {
  const trip = await prisma.trip.findUnique({ where: { id: input.tripId } });
  assertOwned(trip, userId, "trip");

  const last = await prisma.itineraryStop.findFirst({
    where: live(userId, { tripId: input.tripId, stopDate: isoToDbDate(input.stopDate) }),
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.itineraryStop.create({
    data: {
      id: input.id,
      userId,
      tripId: input.tripId,
      stopDate: isoToDbDate(input.stopDate),
      startTime: input.startTime ? timeToDb(input.startTime) : null,
      activity: input.activity,
      location: input.location ?? null,
      note: input.note ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateStop(userId: string, input: UpdateStopInput) {
  const existing = await prisma.itineraryStop.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "stop");

  return prisma.itineraryStop.update({
    where: { id: input.id },
    data: {
      ...(input.stopDate !== undefined ? { stopDate: isoToDbDate(input.stopDate) } : {}),
      ...(input.startTime !== undefined
        ? { startTime: input.startTime ? timeToDb(input.startTime) : null }
        : {}),
      ...(input.activity !== undefined ? { activity: input.activity } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
}

export async function deleteStop(userId: string, id: string) {
  const existing = await prisma.itineraryStop.findUnique({ where: { id } });
  assertOwned(existing, userId, "stop");

  // Soft-deleted, so a pushed event's sourceStop stays resolvable and the
  // event can be flagged as orphaned rather than breaking (system design §3.7).
  await prisma.itineraryStop.update({ where: { id }, data: softDeleted() });
}

/**
 * Plans, and optionally applies, a push of a trip's stops into the calendar.
 *
 * The plan comes from the pure engine; this function's job is to load rows,
 * resolve the Travel category, and apply the result in one transaction.
 *
 * Category is forced to the user's Travel calendar. If none exists the push
 * is blocked rather than creating an uncategorised event, consistent with
 * product spec §4's rule (system design §5.2).
 */
export async function pushTrip(
  userId: string,
  tripId: string,
  mode: "preview" | "apply",
): Promise<PushPreview> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { stops: { include: { pushedEvent: true } } },
  });
  assertOwned(trip, userId, "trip");

  const category = await prisma.calendarCategory.findFirst({
    where: live(userId, {
      name: { equals: TRAVEL_CATEGORY_NAME, mode: "insensitive" as const },
    }),
  });

  if (!category) {
    return { create: 0, update: 0, orphan: 0, unchanged: 0, blocked: "NO_TRAVEL_CATEGORY" };
  }

  const view = toTrip(trip!);
  const stops = trip!.stops.map(toStopModel);

  const existing: PushedEvent[] = trip!.stops
    .filter((stop) => stop.pushedEvent && !stop.pushedEvent.deletedAt)
    .map((stop) => ({
      id: stop.pushedEvent!.id,
      sourceStopId: stop.id,
      eventDate: dbDateToIso(stop.pushedEvent!.eventDate),
      startTime: stop.pushedEvent!.startTime
        ? formatTime(stop.pushedEvent!.startTime)
        : null,
      title: stop.pushedEvent!.title,
      location: stop.pushedEvent!.location,
      note: stop.pushedEvent!.note,
    }));

  const plan = planPush(view, stops, existing);

  const summary: PushPreview = {
    create: plan.create.length,
    update: plan.update.length,
    orphan: plan.orphan.length,
    unchanged: plan.unchanged,
  };

  if (mode === "preview") return summary;

  await prisma.$transaction([
    ...plan.create.map((draft) =>
      prisma.calendarEvent.create({
        data: {
          id: newId(),
          userId,
          title: draft.title,
          eventDate: isoToDbDate(draft.eventDate),
          startTime: draft.startTime ? timeToDb(draft.startTime) : null,
          location: draft.location,
          note: draft.note,
          categoryId: category.id,
          // The unique constraint on this column is what makes a double-click
          // structurally incapable of duplicating (A7).
          sourceStopId: draft.sourceStopId,
        },
      }),
    ),
    ...plan.update.map((patch) =>
      prisma.calendarEvent.update({
        where: { id: patch.id },
        data: {
          title: patch.title,
          eventDate: isoToDbDate(patch.eventDate),
          startTime: patch.startTime ? timeToDb(patch.startTime) : null,
          location: patch.location,
          note: patch.note,
        },
      }),
    ),
  ]);

  return summary;
}

/** Orphaned pushed events, for the prompt A7 asks for. */
export async function listOrphanedEvents(userId: string, tripId: string) {
  const preview = await pushTrip(userId, tripId, "preview");
  return preview.orphan;
}

export async function ensureTravelCategory(userId: string, color = "sky") {
  const existing = await prisma.calendarCategory.findFirst({
    where: live(userId, {
      name: { equals: TRAVEL_CATEGORY_NAME, mode: "insensitive" as const },
    }),
  });
  if (existing) return existing;

  return prisma.calendarCategory.create({
    data: { id: newId(), userId, name: TRAVEL_CATEGORY_NAME, color },
  });
}

type TripRow = { id: string; placeName: string; startDate: Date; endDate: Date };

function toTrip(trip: TripRow): Trip & { dayCount?: number } {
  return {
    id: trip.id,
    placeName: trip.placeName,
    startDate: dbDateToIso(trip.startDate),
    endDate: dbDateToIso(trip.endDate),
  };
}

type StopRow = {
  id: string;
  stopDate: Date;
  startTime: Date | null;
  activity: string;
  location: string | null;
  note: string | null;
  sortOrder: number;
  deletedAt: Date | null;
};

function toStopModel(stop: StopRow): Stop {
  return {
    id: stop.id,
    stopDate: dbDateToIso(stop.stopDate),
    startTime: stop.startTime ? formatTime(stop.startTime) : null,
    activity: stop.activity,
    location: stop.location,
    note: stop.note,
    sortOrder: stop.sortOrder,
    deleted: stop.deletedAt !== null,
  };
}

/** Throws when the trip's dates are impossible, mirroring the check constraint. */
export function assertValidRange(startDate: string, endDate: string) {
  if (endDate < startDate) {
    throw new AppError("VALIDATION_ERROR", "The trip cannot end before it starts.");
  }
}
