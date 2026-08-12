import { describe, expect, it } from "vitest";

import {
  compareStops,
  enumerateDates,
  groupByDay,
  isNoop,
  planPush,
  tripLength,
  type PushedEvent,
  type Stop,
  type Trip,
} from "./sync";

/**
 * Product spec §10's edge cases, plus decisions A7 and A8.
 */

const trip: Trip = {
  id: "t1",
  placeName: "Baguio",
  startDate: "2026-09-12",
  endDate: "2026-09-15",
};

function stop(overrides: Partial<Stop> & { id: string }): Stop {
  return {
    stopDate: "2026-09-12",
    startTime: null,
    activity: "Something",
    location: null,
    note: null,
    sortOrder: 0,
    deleted: false,
    ...overrides,
  };
}

function pushed(overrides: Partial<PushedEvent> & { id: string; sourceStopId: string }): PushedEvent {
  return {
    eventDate: "2026-09-12",
    startTime: null,
    title: "Something",
    location: null,
    note: null,
    ...overrides,
  };
}

describe("pushing to the calendar is idempotent (A7)", () => {
  it("creates an event for each stop on a first push", () => {
    const stops = [
      stop({ id: "s1", activity: "Check in", startTime: "11:00" }),
      stop({ id: "s2", activity: "Market", stopDate: "2026-09-13" }),
    ];

    const plan = planPush(trip, stops, []);
    expect(plan.create).toHaveLength(2);
    expect(plan.update).toHaveLength(0);
    expect(plan.orphan).toHaveLength(0);
  });

  it("changes nothing when pushed twice with no edits", () => {
    // The failure mode product spec §10 names is duplicates. A second push
    // of unchanged stops must be a complete no-op.
    const stops = [stop({ id: "s1", activity: "Check in", startTime: "11:00" })];
    const existing = [
      pushed({ id: "e1", sourceStopId: "s1", title: "Check in", startTime: "11:00" }),
    ];

    const plan = planPush(trip, stops, existing);
    expect(plan.create).toHaveLength(0);
    expect(plan.update).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
    expect(isNoop(plan)).toBe(true);
  });

  it("updates in place after a stop is edited, rather than creating a second event", () => {
    const stops = [stop({ id: "s1", activity: "Check in later", startTime: "13:00" })];
    const existing = [
      pushed({ id: "e1", sourceStopId: "s1", title: "Check in", startTime: "11:00" }),
    ];

    const plan = planPush(trip, stops, existing);
    expect(plan.create).toHaveLength(0);
    expect(plan.update).toEqual([
      {
        id: "e1",
        sourceStopId: "s1",
        eventDate: "2026-09-12",
        startTime: "13:00",
        title: "Check in later",
        location: null,
        note: null,
      },
    ]);
  });

  it("carries the stop's location and note onto the event", () => {
    // Without these two fields on CalendarEvent the push would silently
    // discard them, which is why they were added to the product spec (§3.2).
    const stops = [
      stop({ id: "s1", location: "Upper Session", note: "Ask for the aircon" }),
    ];

    const [draft] = planPush(trip, stops, []).create;
    expect(draft.location).toBe("Upper Session");
    expect(draft.note).toBe("Ask for the aircon");
  });

  it("only pushes an added stop when the rest are already in sync", () => {
    const stops = [
      stop({ id: "s1", activity: "Check in" }),
      stop({ id: "s2", activity: "Dinner", stopDate: "2026-09-13" }),
    ];
    const existing = [pushed({ id: "e1", sourceStopId: "s1", title: "Check in" })];

    const plan = planPush(trip, stops, existing);
    expect(plan.create.map((d) => d.sourceStopId)).toEqual(["s2"]);
    expect(plan.unchanged).toBe(1);
  });
});

describe("deleted and out-of-range stops orphan rather than vanish", () => {
  it("flags the event of a stop deleted after a push (A7)", () => {
    // The event may have been edited directly in the calendar since, so it is
    // flagged for a decision rather than silently removed.
    const stops = [stop({ id: "s1", deleted: true })];
    const existing = [pushed({ id: "e1", sourceStopId: "s1" })];

    const plan = planPush(trip, stops, existing);
    expect(plan.orphan).toEqual(["e1"]);
    expect(plan.create).toHaveLength(0);
  });

  it("flags an event whose stop now falls outside a shortened trip (A8)", () => {
    const shortened: Trip = { ...trip, endDate: "2026-09-13" };
    const stops = [stop({ id: "s1", stopDate: "2026-09-15", activity: "Last day" })];
    const existing = [pushed({ id: "e1", sourceStopId: "s1", eventDate: "2026-09-15" })];

    const plan = planPush(shortened, stops, existing);
    expect(plan.orphan).toEqual(["e1"]);
    expect(plan.create).toHaveLength(0);
  });

  it("flags an event whose stop has disappeared entirely", () => {
    const plan = planPush(trip, [], [pushed({ id: "e1", sourceStopId: "gone" })]);
    expect(plan.orphan).toEqual(["e1"]);
  });
});

describe("day numbering is derived, never stored (A8)", () => {
  it("numbers days from the trip's start date", () => {
    const stops = [
      stop({ id: "s1", stopDate: "2026-09-12", activity: "Arrive" }),
      stop({ id: "s2", stopDate: "2026-09-14", activity: "Hike" }),
    ];

    const { days } = groupByDay(trip, stops);
    expect(days).toHaveLength(4);
    expect(days[0]).toMatchObject({ dayIndex: 1, date: "2026-09-12" });
    expect(days[2]).toMatchObject({ dayIndex: 3, date: "2026-09-14" });
    expect(days[2].stops.map((s) => s.activity)).toEqual(["Hike"]);
  });

  it("keeps out-of-range stops visible in their own bucket when a trip shortens", () => {
    // Product spec §10: stops beyond the new end date "need explicit
    // handling, not silent deletion".
    const shortened: Trip = { ...trip, endDate: "2026-09-13" };
    const stops = [
      stop({ id: "s1", stopDate: "2026-09-12" }),
      stop({ id: "s2", stopDate: "2026-09-15", activity: "Stranded" }),
    ];

    const { days, outside } = groupByDay(shortened, stops);
    expect(days).toHaveLength(2);
    expect(outside.map((s) => s.activity)).toEqual(["Stranded"]);
  });

  it("renumbers correctly rather than remapping when the start date moves", () => {
    const moved: Trip = { ...trip, startDate: "2026-09-13" };
    const stops = [stop({ id: "s1", stopDate: "2026-09-14", activity: "Hike" })];

    const { days } = groupByDay(moved, stops);
    // The same stop is now Day 2 rather than Day 3 — derived from its own
    // date, with nothing to migrate.
    expect(days.find((day) => day.stops.length === 1)?.dayIndex).toBe(2);
  });

  it("spans a month boundary correctly", () => {
    const crossing: Trip = {
      ...trip,
      startDate: "2026-09-29",
      endDate: "2026-10-02",
    };
    const { days } = groupByDay(crossing, []);
    expect(days.map((day) => day.date)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("spans a year boundary correctly", () => {
    expect(enumerateDates("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("counts a single-day trip as one day", () => {
    expect(tripLength({ ...trip, endDate: trip.startDate })).toBe(1);
  });

  it("treats a trip with no stops as a valid, unplanned state", () => {
    const { days, outside } = groupByDay(trip, []);
    expect(days).toHaveLength(4);
    expect(days.every((day) => day.stops.length === 0)).toBe(true);
    expect(outside).toHaveLength(0);
  });
});

describe("untimed stops sort sensibly within their day", () => {
  it("puts untimed stops before timed ones rather than at midnight", () => {
    // Product spec §10 warns against them "defaulting to midnight and
    // appearing first misleadingly" — they lead as a group because they are
    // genuinely unscheduled, not because they are at 00:00.
    const sorted = [
      stop({ id: "a", startTime: "09:30" }),
      stop({ id: "b", startTime: null, sortOrder: 2 }),
      stop({ id: "c", startTime: null, sortOrder: 1 }),
      stop({ id: "d", startTime: "08:00" }),
    ].sort(compareStops);

    expect(sorted.map((s) => s.id)).toEqual(["c", "b", "d", "a"]);
  });
});
