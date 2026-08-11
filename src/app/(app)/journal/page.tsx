import { requireSession } from "@/core/auth/session";
import { formatHeaderDate, today, todayIso } from "@/core/date";
import { PageHeader } from "@/core/ui/page-header";
import { listEntries } from "@/modules/journal/service";
import { JournalPage } from "@/modules/journal/ui/journal-page";

export default async function Journal() {
  const session = await requireSession();
  const entries = await listEntries(session.userId);

  return (
    <>
      <PageHeader
        kicker={formatHeaderDate(today(session.timezone))}
        title="Journal"
      />
      <div className="flex-1 overflow-auto">
        <JournalPage initial={entries} todayIso={todayIso(session.timezone)} />
      </div>
    </>
  );
}
