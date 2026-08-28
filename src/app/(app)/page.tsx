import { requireSession } from "@/core/auth/session";
import { formatHeaderDate, today, todayIso as todayIsoOf } from "@/core/date";
import { add } from "@/core/money";
import { PageHeader } from "@/core/ui/page-header";
import { listCategories, listTodayEvents } from "@/modules/calendar/service";
import { listBudgets } from "@/modules/finance/service";
import { habitSummary } from "@/modules/habits/service";
import { GlanceStrip } from "@/modules/home/ui/glance-strip";
import { QuickActions } from "@/modules/home/ui/quick-actions";
import { TaskSnapshot } from "@/modules/home/ui/task-snapshot";
import { TodaySchedule } from "@/modules/home/ui/today-schedule";
import { listTrips } from "@/modules/itinerary/service";
import { listBuckets } from "@/modules/tasks/service";

/**
 * Home holds no data of its own (product spec §3) — every number here comes
 * from the owning module's own summary function. This file only fetches in
 * parallel and lays the results out; it never queries Prisma itself.
 */
export default async function Home() {
  const session = await requireSession();
  const todayIso = todayIsoOf(session.timezone);
  const month = todayIso.slice(0, 7);

  const [buckets, events, categories, habits, budgets, trips] = await Promise.all([
    listBuckets(session.userId, session.timezone),
    listTodayEvents(session.userId, session.timezone),
    listCategories(session.userId),
    habitSummary(session.userId, todayIso, session.weekStartsOn),
    listBudgets(session.userId, month),
    listTrips(session.userId),
  ]);

  const allBudgets = [...budgets.groups.flatMap((group) => group.budgets), ...budgets.ungrouped];
  const budgetTotals =
    allBudgets.length === 0
      ? null
      : {
          limit: add(...allBudgets.map((b) => b.limitAmount)).toString(),
          spent: add(...allBudgets.map((b) => b.spent)).toString(),
        };

  const nextTrip =
    trips
      .filter((trip) => trip.endDate >= todayIso)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;

  return (
    <>
      <PageHeader
        kicker={formatHeaderDate(today(session.timezone))}
        title="Today"
        actions={<QuickActions categories={categories} todayIso={todayIso} />}
      />

      <div className="flex-1 overflow-auto">
        <div className="grid max-w-260 grid-cols-1 items-start gap-5.5 p-8 lg:grid-cols-[1.3fr_1fr]">
          <TodaySchedule events={events} categories={categories} />
          <TaskSnapshot initial={buckets} />
        </div>

        <GlanceStrip
          habitsDue={Math.max(0, habits.dueToday - habits.doneToday)}
          budget={budgetTotals}
          nextTrip={nextTrip}
          currency={session.currency}
        />
      </div>
    </>
  );
}
