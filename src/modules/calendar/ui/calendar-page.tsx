"use client";

import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useMemo, useState } from "react";

import { todayIso } from "@/core/date";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/ui/cn";
import { Segmented } from "@/core/ui/segmented";
import type { CategoryView, EventView } from "../schema";

import { CategoryRail } from "./category-rail";
import { EventModal } from "./event-modal";

/** How many events a day cell shows before it truncates (product spec §4). */
const DAY_CELL_LIMIT = 3;

export function CalendarPage({
  initialCategories,
  initialEvents,
  initialMonth,
  weekStartsOn,
  timezone,
}: {
  initialCategories: CategoryView[];
  initialEvents: EventView[];
  initialMonth: string;
  weekStartsOn: number;
  timezone: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<"month" | "list">("month");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ event: EventView | null; date: string } | null>(
    null,
  );

  const { data: categories = initialCategories } = useQuery({
    queryKey: ["calendar", "categories"],
    queryFn: () => api.get<CategoryView[]>("/api/calendar/categories"),
    initialData: initialCategories,
  });

  const { data: events = initialEvents } = useQuery({
    queryKey: ["calendar", "events", month],
    queryFn: () => api.get<EventView[]>(`/api/calendar/events?month=${month}`),
    initialData: month === initialMonth ? initialEvents : undefined,
  });

  const colorOf = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.color]));
    // Colour is a lookup through the category, never copied onto the event —
    // which is what makes a recolour apply to history immediately (spec §4).
    return (categoryId: string) => map.get(categoryId) ?? "warmgray";
  }, [categories]);

  const visible = useMemo(
    () => events.filter((event) => !hidden.has(event.categoryId)),
    [events, hidden],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, EventView[]>();
    for (const event of visible) {
      const list = map.get(event.eventDate) ?? [];
      list.push(event);
      map.set(event.eventDate, list);
    }
    // A2: untimed events form an "all day" band above the timed ones rather
    // than sorting as midnight and appearing first for the wrong reason.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.startTime === b.startTime) return a.title.localeCompare(b.title);
        if (!a.startTime) return -1;
        if (!b.startTime) return 1;
        return a.startTime.localeCompare(b.startTime);
      });
    }
    return map;
  }, [visible]);

  const cursor = DateTime.fromFormat(month, "yyyy-MM", { zone: "utc" });
  const canCreate = categories.length > 0;

  return (
    <div className="flex min-h-0 flex-1">
      <CategoryRail
        categories={categories}
        hidden={hidden}
        onToggle={(id) =>
          setHidden((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-6 py-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(cursor.minus({ months: 1 }).toFormat("yyyy-MM"))}
            className="px-1.5 font-mono text-[13px] text-muted"
          >
            ‹
          </button>
          <div className="min-w-37.5 font-mono text-[12.5px]">
            {cursor.toFormat("LLLL yyyy")}
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(cursor.plus({ months: 1 }).toFormat("yyyy-MM"))}
            className="px-1.5 font-mono text-[13px] text-muted"
          >
            ›
          </button>

          <Segmented
            className="ml-4"
            aria-label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { label: "Month", value: "month" },
              { label: "List", value: "list" },
            ]}
          />

          <div className="ml-auto">
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() =>
                setModal({ event: null, date: cursor.toFormat("yyyy-MM-01") })
              }
            >
              + new event
            </Button>
          </div>
        </div>

        {/*
          Product spec §4: on a fresh account event creation must prompt the
          user to create a calendar first, rather than allowing an
          uncategorised event. The FK is non-nullable, so this is the UI half
          of a rule the schema already enforces.
        */}
        {!canCreate && (
          <p className="m-0 border-b border-border px-6 py-3 font-mono text-[11.5px] text-muted">
            create a calendar first — every event belongs to one
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {view === "month" ? (
            <MonthGrid
              cursor={cursor}
              byDate={byDate}
              colorOf={colorOf}
              weekStartsOn={weekStartsOn}
              onPick={(date, event) => canCreate && setModal({ event, date })}
            />
          ) : (
            <AgendaList
              byDate={byDate}
              colorOf={colorOf}
              onPick={setModal}
              today={todayIso(timezone)}
            />
          )}
        </div>
      </div>

      {modal && (
        <EventModal
          event={modal.event}
          defaultDate={modal.date}
          categories={categories}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function MonthGrid({
  cursor,
  byDate,
  colorOf,
  weekStartsOn,
  onPick,
}: {
  cursor: DateTime;
  byDate: Map<string, EventView[]>;
  colorOf: (categoryId: string) => string;
  weekStartsOn: number;
  onPick: (date: string, event: EventView | null) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Grid starts on the user's chosen week start (decision A5's setting).
  const first = cursor.startOf("month");
  const offset = (first.weekday - weekStartsOn + 7) % 7;
  const gridStart = first.minus({ days: offset });
  const days = Array.from({ length: 42 }, (_, i) => gridStart.plus({ days: i }));

  const headers = Array.from({ length: 7 }, (_, i) =>
    DateTime.fromObject({ weekday: (((weekStartsOn - 1 + i) % 7) + 1) as 1 }).toFormat(
      "ccc",
    ),
  );

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border">
        {headers.map((label) => (
          <div key={label} className="kicker px-3 py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = day.toFormat("yyyy-MM-dd");
          const inMonth = day.month === cursor.month;
          const all = byDate.get(iso) ?? [];
          const showAll = expanded === iso;
          const shown = showAll ? all : all.slice(0, DAY_CELL_LIMIT);
          const hiddenCount = all.length - shown.length;

          return (
            <div
              key={iso}
              className={cn(
                "min-h-26 border-b border-r border-border p-2",
                !inMonth && "opacity-40",
              )}
            >
              <button
                type="button"
                onClick={() => onPick(iso, null)}
                aria-label={`Add an event on ${day.toFormat("LLLL d")}`}
                className="mb-1 font-mono text-[11px] text-muted"
              >
                {day.day}
              </button>

              <div className="flex flex-col gap-0.5">
                {shown.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onPick(iso, event)}
                    className="flex items-center gap-1.5 text-left font-mono text-[11px]"
                  >
                    <span
                      aria-hidden
                      className="size-1.5 flex-none rounded-full"
                      style={{ background: `var(--accent-${colorOf(event.categoryId)})` }}
                    />
                    {event.startTime && (
                      <span className="flex-none text-muted">{event.startTime}</span>
                    )}
                    <span className="min-w-0 truncate">{event.title}</span>
                  </button>
                ))}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(iso)}
                    className="text-left font-mono text-[10.5px] text-muted"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({
  byDate,
  colorOf,
  onPick,
  today,
}: {
  byDate: Map<string, EventView[]>;
  colorOf: (categoryId: string) => string;
  onPick: (pick: { event: EventView; date: string }) => void;
  today: string;
}) {
  const dates = [...byDate.keys()].sort();

  if (dates.length === 0) {
    return (
      <p className="py-17.5 text-center font-mono text-[12px] text-muted">
        no events this month
      </p>
    );
  }

  return (
    <div className="max-w-200 px-8 pt-2 pb-15">
      {dates.map((date) => {
        const day = DateTime.fromFormat(date, "yyyy-MM-dd", { zone: "utc" });
        const isToday = date === today;

        return (
          <div
            key={date}
            className="flex gap-5.5 border-b border-dashed border-border py-4.5"
          >
            <div className="w-14.5 flex-none text-right">
              <div
                className={cn(
                  "font-mono text-[22px] leading-[1.1]",
                  isToday ? "text-accent" : "text-text",
                )}
              >
                {day.day}
              </div>
              <div className="font-mono text-[10px] tracking-widest text-muted">
                {day.toFormat("ccc").toUpperCase()}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              {byDate.get(date)!.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onPick({ event, date })}
                  className="flex w-full items-baseline gap-3 text-left"
                >
                  <span
                    aria-hidden
                    className="size-2 flex-none translate-y-0.5 rounded-full"
                    style={{ background: `var(--accent-${colorOf(event.categoryId)})` }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14.5px]">
                    {event.title}
                  </span>
                  <span className="flex-none font-mono text-[11.5px] text-muted">
                    {event.startTime
                      ? DateTime.fromFormat(event.startTime, "HH:mm").toFormat("h:mm a")
                      : "all-day"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
