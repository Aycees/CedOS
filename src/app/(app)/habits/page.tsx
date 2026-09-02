import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { listToday } from "@/modules/habits/service";
import { HabitsPage } from "@/modules/habits/ui/habits-page";
import { getSettings } from "@/modules/settings/service";

export default async function Habits() {
  const session = await requireSession();
  const today = todayIso(session.timezone);
  const settings = await getSettings(session.userId);
  const habits = await listToday(session.userId, today, settings.weekStartsOn);

  return (
    <div className="flex-1 overflow-auto">
      <HabitsPage initialToday={habits} today={today} />
    </div>
  );
}
