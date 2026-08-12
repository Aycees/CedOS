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
 */
export function TaskSnapshot({ initial }: { initial: BucketView }) {
  const queryClient = useQueryClient();

  const { data: buckets } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.get<BucketView[]>("/api/tasks"),
    initialData: [initial],
  });

  const bucket = buckets.find((b) => b.bucket === "TODAY") ?? initial;
  const open = bucket.tasks.filter((task) => !task.completedAt);

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

      {open.length === 0 ? (
        <p className="m-0 py-1.5 font-serif text-[15px] italic text-muted">
          no tasks for today
        </p>
      ) : (
        open.map((task) => (
          <div key={task.id} className="row-divider list-row flex items-start gap-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={false}
              aria-label={`Complete ${task.title}`}
              onClick={() => toggle.mutate(task)}
              className="mt-0.5 grid size-[15px] flex-none place-items-center rounded-[4px] border-[1.5px] border-checkbox"
            />
            <span className={cn("min-w-0 flex-1 font-mono text-[13px]")}>{task.title}</span>
          </div>
        ))
      )}
    </Card>
  );
}
