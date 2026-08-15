import { DateTime } from "luxon";

import { requireSession } from "@/core/auth/session";
import { PageHeader } from "@/core/ui/page-header";
import { listCategories, listEventsInMonth } from "@/modules/calendar/service";
import { CalendarPage } from "@/modules/calendar/ui/calendar-page";
import { getSettings } from "@/modules/settings/service";

export default async function Calendar() {
  const session = await requireSession();
  const month = DateTime.now().setZone(session.timezone).toFormat("yyyy-MM");

  const [categories, events, settings] = await Promise.all([
    listCategories(session.userId),
    listEventsInMonth(session.userId, month, session.timezone),
    getSettings(session.userId),
  ]);

  return (
    <>
      <PageHeader className="hidden lg:flex" kicker="Plan" title="Calendar" />
      <CalendarPage
        initialCategories={categories}
        initialEvents={events}
        initialMonth={month}
        weekStartsOn={settings.weekStartsOn}
        timezone={session.timezone}
      />
    </>
  );
}
