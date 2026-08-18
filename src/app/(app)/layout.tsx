import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session";
import { today, todayIso, formatSidebarDate } from "@/core/date";
import { countTodayEvents } from "@/modules/calendar/service";
import { countDueToday } from "@/modules/habits/service";
import { countOpenTasks } from "@/modules/tasks/service";
import { AppearanceProvider } from "@/core/theme/appearance-provider";
import { AppShell } from "@/core/ui/app-shell";

import { AppearanceSync } from "./appearance-sync";

/**
 * The authenticated shell: dotted canvas, left rail, scrolling main column.
 *
 * The dot layer is a fixed background rather than a body-level repeat so it
 * stays put while the main column scrolls, matching the mockup.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [openTasks, todayEvents, habitsDue] = await Promise.all([
    countOpenTasks(session.userId),
    countTodayEvents(session.userId, session.timezone),
    countDueToday(session.userId, todayIso(session.timezone)),
  ]);

  return (
    <AppearanceProvider
      initial={{
        theme: session.theme,
        accent: session.accent as "blue" | "green" | "terracotta" | "violet",
        density: session.density,
      }}
    >
      <AppearanceSync />
      <AppShell
        sidebarProps={{
          name: session.name,
          dateLabel: formatSidebarDate(today(session.timezone)),
          badges: { openTasks, todayEvents, habitsDue },
        }}
      >
        {children}
      </AppShell>
    </AppearanceProvider>
  );
}
