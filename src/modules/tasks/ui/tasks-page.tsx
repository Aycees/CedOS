"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import type { BucketView, TaskBucket, TaskView } from "../schema";

const TASKS_KEY = ["tasks"];

export function TasksPage({ initial }: { initial: BucketView[] }) {
  const { data: buckets = initial } = useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => api.get<BucketView[]>("/api/tasks"),
    initialData: initial,
  });

  return (
    <div className="grid max-w-[1040px] grid-cols-1 items-start gap-[22px] p-8 lg:grid-cols-3">
      {buckets.map((bucket) => (
        <BucketCard key={bucket.bucket} bucket={bucket} />
      ))}
    </div>
  );
}

function BucketCard({ bucket }: { bucket: BucketView }) {
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TASKS_KEY });

  const create = useMutation({
    mutationFn: (title: string) =>
      api.post("/api/tasks", { id: newId(), title, bucket: bucket.bucket }),
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: (task: TaskView) =>
      api.patch("/api/tasks", { id: task.id, completed: !task.completedAt }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tasks?id=${id}`),
    onSuccess: invalidate,
  });

  // A3: completed items stay visible and struck through, but fold behind a
  // toggle once they are more than 7 days old. Nothing is ever auto-deleted.
  const visible = bucket.tasks.filter((task) => !task.collapsed);
  const collapsed = bucket.tasks.filter((task) => task.collapsed);

  return (
    <Card className="pb-4">
      <div className="mb-1 flex items-baseline gap-2.5">
        <h2 className="m-0 font-serif text-[18px] font-normal">{bucket.label}</h2>
        <span className="ml-auto font-mono text-[11px] text-muted">
          {bucket.done}/{bucket.total}
        </span>
      </div>

      {visible.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={() => toggle.mutate(task)}
          onRemove={() => remove.mutate(task.id)}
        />
      ))}

      {collapsed.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="row-divider mt-1 w-full pt-2.5 text-left font-mono text-[11px] text-muted"
          >
            {showCompleted ? "hide" : "show"} {collapsed.length} completed
          </button>
          {showCompleted &&
            collapsed.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggle.mutate(task)}
                onRemove={() => remove.mutate(task.id)}
              />
            ))}
        </>
      )}

      {/*
        Product spec §5: the input affordance shows regardless — a bucket is
        never hidden or emptied of its way in just because it has no tasks.
      */}
      <AddTaskInput
        bucket={bucket.bucket}
        onAdd={(title) => create.mutate(title)}
        empty={bucket.total === 0}
      />
    </Card>
  );
}

function TaskRow({
  task,
  onToggle,
  onRemove,
}: {
  task: TaskView;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const done = Boolean(task.completedAt);

  return (
    <div className="row-divider list-row group flex items-start gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={onToggle}
        className={cn(
          "mt-0.5 grid size-[15px] flex-none place-items-center rounded-[4px] border-[1.5px]",
          done ? "border-accent bg-accent text-on-dark" : "border-checkbox",
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

      <button
        type="button"
        aria-label={`Remove ${task.title}`}
        onClick={onRemove}
        className="flex-none font-mono text-[11px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

function AddTaskInput({
  bucket,
  onAdd,
  empty,
}: {
  bucket: TaskBucket;
  onAdd: (title: string) => void;
  empty: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const title = value.trim();
    if (!title) return;
    onAdd(title);
    setValue("");
  };

  return (
    <div className={cn("pt-2", empty ? "" : "row-divider mt-1")}>
      {empty && (
        <p className="m-0 mb-2 font-serif text-[15px] italic text-muted">
          nothing here yet
        </p>
      )}
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
        onBlur={submit}
        placeholder="+ add a task"
        aria-label={`Add a task to ${bucket.toLowerCase().replace("_", " ")}`}
        className="w-full rounded-[8px] border border-dashed border-border-strong bg-transparent px-2.5 py-2 font-mono text-[12px] text-text outline-none placeholder:text-muted"
      />
    </div>
  );
}
