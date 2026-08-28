"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { api } from "@/core/mutation/client";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import type { BucketView, TaskView } from "@/modules/tasks/schema";

/**
 * Today's bucket, with the same complete/reopen toggle Tasks itself uses
 * (`PATCH /api/tasks`) — sharing the endpoint is what makes "updates the
 * count without a reload" true here for free, via the same query key Tasks
 * invalidates against.
 *
 * `initial` carries every bucket, not just today's, even though this card
 * only renders TODAY: the Tasks page reads the same ["tasks"] cache entry,
 * and seeding it with a today-only slice here would leave THIS_WEEK and
 * SOMEDAY missing until that query re-fetches.
 */
export function TaskSnapshot({ initial }: { initial: BucketView[] }) {
  const queryClient = useQueryClient();

  const { data: buckets } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.get<BucketView[]>("/api/tasks"),
    initialData: initial,
  });

  const initialToday = initial.find((b) => b.bucket === "TODAY");
  const bucket = buckets.find((b) => b.bucket === "TODAY") ?? initialToday!;

  const toggle = useMutation({
    mutationFn: (task: TaskView) =>
      api.patch("/api/tasks", { id: task.id, completed: !task.completedAt }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <Card>
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <h2 className="m-0 font-serif text-[18px] font-normal">Tasks</h2>
        <Link href="/tasks" className="ml-auto font-mono text-[11.5px] text-accent-blue">
          all →
        </Link>
      </div>

      {bucket.tasks.length === 0 ? (
        <p className="m-0 py-1.5 font-serif text-[15px] italic text-muted">
          no tasks for today
        </p>
      ) : (
        bucket.tasks.map((task) => {
          const done = Boolean(task.completedAt);

          return (
            <div key={task.id} className="row-divider list-row flex items-start gap-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                onClick={() => toggle.mutate(task)}
                className={cn(
                  "mt-0.5 grid size-4.25 flex-none place-items-center rounded-[5px] border-[1.5px]",
                  done ? "border-accent-green bg-accent-green text-on-dark" : "border-checkbox",
                )}
              >
                {done ? <span className="font-mono text-[9px] leading-none">✓</span> : null}
              </button>
              <span
                className={cn(
                  "min-w-0 flex-1 font-mono text-[13px]",
                  done && "text-muted line-through",
                )}
              >
                {task.title}
              </span>
            </div>
          );
        })
      )}
    </Card>
  );
}
