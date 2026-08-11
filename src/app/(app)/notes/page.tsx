import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { PageHeader } from "@/core/ui/page-header";
import { listNotes, listTags } from "@/modules/notes/service";
import { NotesPage } from "@/modules/notes/ui/notes-page";

export default async function Notes() {
  const session = await requireSession();
  const [notes, tags] = await Promise.all([
    listNotes(session.userId),
    listTags(session.userId),
  ]);

  return (
    <>
      <PageHeader kicker="Capture" title="Notes" />
      <div className="flex-1 overflow-auto">
        <NotesPage
          initial={notes}
          tags={tags}
          todayIso={todayIso(session.timezone)}
        />
      </div>
    </>
  );
}
