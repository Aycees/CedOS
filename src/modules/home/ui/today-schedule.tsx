import Link from "next/link";

import { Card } from "@/core/ui/card";
import type { CategoryView, EventView } from "@/modules/calendar/schema";

/**
 * Today's events, time-ordered with untimed events grouped first (A2, the
 * same rule as the calendar list view). Read-only — editing happens on the
 * Calendar page itself, which "open calendar →" links to.
 */
export function TodaySchedule({
  events,
  categories,
}: {
  events: EventView[];
  categories: CategoryView[];
}) {
  const colorOf = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.color ?? "warmgray";

  const sorted = [...events].sort((a, b) => {
    if (a.startTime === null && b.startTime === null) return 0;
    if (a.startTime === null) return -1;
    if (b.startTime === null) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <Card>
      <div className="mb-1 flex items-baseline gap-2.5">
        <h2 className="m-0 font-serif text-[18px] font-normal">Today&rsquo;s schedule</h2>
        <Link href="/calendar" className="ml-auto font-mono text-[11.5px] text-accent-blue">
          open calendar →
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="m-0 py-3 font-serif text-[15px] italic text-muted">
          nothing on the calendar today
        </p>
      ) : (
        sorted.map((event) => (
          <div
            key={event.id}
            className="row-divider list-row flex items-center gap-2.5 font-mono text-[13px]"
          >
            <span
              aria-hidden
              className="size-1.75 flex-none rounded-full"
              style={{ background: `var(--accent-${colorOf(event.categoryId)})` }}
            />
            <span className="min-w-0 flex-1 truncate">{event.title}</span>
            <span className="flex-none text-[11px] text-muted">
              {event.startTime ?? "all day"}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}
