import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { listEntries } from "@/modules/journal/service";
import { JournalPage } from "@/modules/journal/ui/journal-page";

export default async function Journal() {
  const session = await requireSession();
  const entries = await listEntries(session.userId);

  return <JournalPage initial={entries} todayIso={todayIso(session.timezone)} />;
}
