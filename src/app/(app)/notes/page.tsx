import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { listNotes } from "@/modules/notes/service";
import { NotesPage } from "@/modules/notes/ui/notes-page";

export default async function Notes() {
  const session = await requireSession();
  const notes = await listNotes(session.userId);

  return <NotesPage initial={notes} todayIso={todayIso(session.timezone)} />;
}
