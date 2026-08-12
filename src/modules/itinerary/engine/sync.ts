/**
 * The itinerary → calendar sync engine.
 *
 * Pure functions, no I/O (system design §5.2). `planPush` returns a *plan*
 * that the service then applies in a single database transaction. Separating
 * planning from application is what lets the push be previewed — "this will
 * update 6 events and create 2" — reusing the same impact-preview shape as A1.
 *
 * Idempotency is structural rather than conventional: `CalendarEvent.
 * sourceStopId` is unique, so a double-click cannot duplicate and a re-push
 * after edits updates in place. Duplicates are the failure mode product spec
 * §10 explicitly names, and this is what makes them impossible.
 */

export type IsoDate = string;

export type Trip = {
  id: string;
  placeName: string;
  startDate: IsoDate;
  endDate: IsoDate;
};

export type Stop = {
  id: string;
  stopDate: IsoDate;
  /** "HH:mm", or null for an untimed stop. */
  startTime: string | null;
  activity: string;
  location: string | null;
  note: string | null;
  sortOrder: number;
  /** Soft-deleted stops keep their pushed event resolvable (system design §3.7). */
  deleted: boolean;
};

export type PushedEvent = {
  id: string;
  sourceStopId: string;
  eventDate: IsoDate;
  startTime: string | null;
  title: string;
  location: string | null;
  note: string | null;
};

export type EventDraft = {
  sourceStopId: string;
  eventDate: IsoDate;
  startTime: string | null;
  title: string;
  location: string | null;
  note: string | null;
};

export type EventPatch = EventDraft & { id: string };

export type PushPlan = {
  create: EventDraft[];
  update: EventPatch[];
  /** Events whose stop no longer exists, or has moved outside the trip. */
  orphan: string[];
  /** Already in sync — counted so the preview can say "nothing to change". */
  unchanged: number;
};

/** A stop belongs to the trip only while its date sits inside the trip window. */
export function isWithinTrip(trip: Trip, stop: Stop): boolean {
  return stop.stopDate >= trip.startDate && stop.stopDate <= trip.endDate;
}

function draftFor(stop: Stop): EventDraft {
  return {
    sourceStopId: stop.id,
    eventDate: stop.stopDate,
    startTime: stop.startTime,
    title: stop.activity,
    // Location and note ride along because CalendarEvent carries them — the
    // two fields added to the product spec for exactly this reason (§3.2).
    location: stop.location,
    note: stop.note,
  };
}

function differs(draft: EventDraft, event: PushedEvent): boolean {
  return (
    draft.eventDate !== event.eventDate ||
    draft.startTime !== event.startTime ||
    draft.title !== event.title ||
    draft.location !== event.location ||
    draft.note !== event.note
  );
}

export function planPush(
  trip: Trip,
  stops: Stop[],
  existing: PushedEvent[],
): PushPlan {
  const byStop = new Map(existing.map((event) => [event.sourceStopId, event]));

  const plan: PushPlan = { create: [], update: [], orphan: [], unchanged: 0 };

  for (const stop of stops) {
    // A deleted stop, or one dragged outside the trip's dates, is handled
    // below as an orphan rather than pushed.
    if (stop.deleted || !isWithinTrip(trip, stop)) continue;

    const draft = draftFor(stop);
    const event = byStop.get(stop.id);

    if (!event) {
      plan.create.push(draft);
      continue;
    }

    if (differs(draft, event)) {
      plan.update.push({ ...draft, id: event.id });
    } else {
      plan.unchanged += 1;
    }
  }

  /*
   * A7: a stop deleted after a push leaves its event flagged rather than
   * silently vanishing, because the event may have been edited directly in
   * the calendar since. The same applies when a trip is shortened and a stop
   * falls outside the new dates (A8).
   */
  const stopsById = new Map(stops.map((stop) => [stop.id, stop]));
  for (const event of existing) {
    const stop = stopsById.get(event.sourceStopId);
    if (!stop || stop.deleted || !isWithinTrip(trip, stop)) {
      plan.orphan.push(event.id);
    }
  }

  return plan;
}

/** Whether a plan would change anything at all. */
export function isNoop(plan: PushPlan): boolean {
  return plan.create.length === 0 && plan.update.length === 0 && plan.orphan.length === 0;
}

/**
 * Groups a trip's stops into days.
 *
 * "Day 2" is derived from the absolute date, never stored — the same
 * principle as deriving age from a birthday (A8). Storing a day index is what
 * creates the remapping problem when a trip is shortened.
 *
 * Stops that fall outside the trip's current dates come back in their own
 * bucket rather than being hidden or deleted, so shortening a trip surfaces
 * them for a decision instead of losing them.
 */
export function groupByDay(
  trip: Trip,
  stops: Stop[],
): {
  days: { dayIndex: number; date: IsoDate; stops: Stop[] }[];
  outside: Stop[];
} {
  const live = stops.filter((stop) => !stop.deleted);
  const inside = live.filter((stop) => isWithinTrip(trip, stop));
  const outside = live.filter((stop) => !isWithinTrip(trip, stop));

  const dates = enumerateDates(trip.startDate, trip.endDate);

  return {
    days: dates.map((date, index) => ({
      dayIndex: index + 1,
      date,
      stops: inside.filter((stop) => stop.stopDate === date).sort(compareStops),
    })),
    outside: outside.sort(compareStops),
  };
}

/**
 * Untimed stops sort before timed ones within their day.
 *
 * Product spec §10 warns against letting them default to midnight and appear
 * first "misleadingly" — the point is that they are genuinely unscheduled, so
 * they head the day as a group rather than pretending to be at 00:00.
 */
export function compareStops(a: Stop, b: Stop): number {
  if (a.startTime === b.startTime) return a.sortOrder - b.sortOrder;
  if (a.startTime === null) return -1;
  if (b.startTime === null) return 1;
  return a.startTime.localeCompare(b.startTime);
}

/** Inclusive list of calendar dates, computed without any zone involvement. */
export function enumerateDates(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** How many days a trip spans, inclusive of both ends. */
export function tripLength(trip: Trip): number {
  return enumerateDates(trip.startDate, trip.endDate).length;
}
