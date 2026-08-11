import Link from "next/link";

import { requireSession } from "@/core/auth/session";
import { formatHeaderDate, today } from "@/core/date";
import { Card } from "@/core/ui/card";
import { PageHeader } from "@/core/ui/page-header";
import { listBuckets } from "@/modules/tasks/service";

/**
 * Home holds no data of its own — it is a live rollup composed from each
 * app's own summary logic (product spec §3).
 *
 * Only the Tasks snapshot is real so far; the schedule and at-a-glance strip
 * fill in as Calendar (phase 3) and Habits (phase 5) land. The full dashboard
 * is phase 9, deliberately last, because it is pure composition.
 */
export default async function Home() {
  const session = await requireSession();
  const buckets = await listBuckets(session.userId, session.timezone);
  const todayBucket = buckets.find((bucket) => bucket.bucket === "TODAY");
  const open = todayBucket?.tasks.filter((task) => !task.completedAt) ?? [];

  return (
    <>
      <PageHeader
        kicker={formatHeaderDate(today(session.timezone))}
        title="Today"
      />

      <div className="flex-1 overflow-auto">
        <div className="grid max-w-[1040px] grid-cols-1 items-start gap-[22px] p-8 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <div className="mb-1 flex items-baseline gap-2.5">
              <h2 className="m-0 font-serif text-[18px] font-normal">
                Today&rsquo;s schedule
              </h2>
              <Link
                href="/calendar"
                className="ml-auto font-mono text-[11.5px] text-accent-blue"
              >
                open calendar →
              </Link>
            </div>
            {/* Calm empty state, never a blank void (product spec §3). */}
            <p className="m-0 py-3 font-serif text-[15px] italic text-muted">
              nothing on the calendar today
            </p>
          </Card>

          <Card>
            <div className="mb-2.5 flex items-baseline gap-2.5">
              <h2 className="m-0 font-serif text-[18px] font-normal">Tasks</h2>
              <Link
                href="/tasks"
                className="ml-auto font-mono text-[11.5px] text-accent-blue"
              >
                all →
              </Link>
            </div>

            {open.length === 0 ? (
              <p className="m-0 py-1.5 font-serif text-[15px] italic text-muted">
                no tasks for today
              </p>
            ) : (
              open.map((task) => (
                <div
                  key={task.id}
                  className="list-row flex items-start gap-2.5 font-mono text-[13px]"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 size-[15px] flex-none rounded-[4px] border-[1.5px] border-checkbox"
                  />
                  {task.title}
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
