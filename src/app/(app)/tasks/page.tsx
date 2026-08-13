import { requireSession } from "@/core/auth/session";
import { PageHeader } from "@/core/ui/page-header";
import { listBuckets } from "@/modules/tasks/service";
import { TasksPage } from "@/modules/tasks/ui/tasks-page";

export default async function Tasks() {
  const session = await requireSession();
  const buckets = await listBuckets(session.userId, session.timezone);
  const openCount = buckets.reduce((sum, bucket) => sum + (bucket.total - bucket.done), 0);

  return (
    <>
      <PageHeader kicker={`Tasks · ${openCount} open`} title="Tasks" />
      <div className="flex-1 overflow-auto">
        <TasksPage initial={buckets} />
      </div>
    </>
  );
}
