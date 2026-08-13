"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
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
    <div className="mx-auto flex max-w-260 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {buckets.map((bucket) => (
        <TaskSection key={bucket.bucket} bucket={bucket} />
      ))}
    </div>
  );
}

function TaskSection({ bucket }: { bucket: BucketView }) {
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

  const rename = useMutation({
    mutationFn: (input: { id: string; title: string }) =>
      api.patch("/api/tasks", input),
    onSuccess: invalidate,
  });

  // A3: completed items stay visible and struck through, but fold behind a
  // toggle once they are more than 7 days old. Nothing is ever auto-deleted.
  const visible = bucket.tasks.filter((task) => !task.collapsed);
  const collapsed = bucket.tasks.filter((task) => task.collapsed);
  const open = bucket.total - bucket.done;

  return (
    <section className="mb-8.5">
      <div className="mb-2 flex items-baseline gap-2.5">
        <h2 className="m-0 font-mono text-[10.5px] font-normal uppercase tracking-[0.14em] text-muted">
          {bucket.label}
        </h2>
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10.5px] text-muted">
          {open}/{bucket.total}
        </span>
      </div>

      {visible.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={() => toggle.mutate(task)}
          onRemove={() => remove.mutate(task.id)}
          onRename={(title) => rename.mutate({ id: task.id, title })}
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
                onRename={(title) => rename.mutate({ id: task.id, title })}
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
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
  onRemove,
  onRename,
}: {
  task: TaskView;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (title: string) => void;
}) {
  const done = Boolean(task.completedAt);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== task.title) {
      onRename(trimmed);
    } else {
      setValue(task.title);
    }
  };

  return (
    <div className="row-divider list-row flex items-start gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={onToggle}
        className={cn(
          "mt-0.5 grid size-4.25 flex-none place-items-center rounded-[5px] border-[1.5px]",
          done ? "border-accent-green bg-accent-green text-on-dark" : "border-checkbox",
        )}
      >
        {done ? <span className="font-mono text-[9px] leading-none">✓</span> : null}
      </button>

      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setValue(task.title);
              setEditing(false);
            }
          }}
          aria-label="Task title"
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-text outline-none"
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Rename ${task.title}`}
          onClick={() => {
            setValue(task.title);
            setEditing(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setValue(task.title);
              setEditing(true);
            }
          }}
          className={cn(
            "min-w-0 flex-1 font-mono text-[13px]",
            done && "text-muted line-through",
          )}
        >
          {task.title}
        </span>
      )}

      <button
        type="button"
        aria-label={`Remove ${task.title}`}
        onClick={onRemove}
        className="flex-none font-mono text-[11px] text-muted"
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
      <div className="flex items-center gap-2.5 py-1">
        <div className="size-4.25 flex-none rounded-[5px] border-[1.5px] border-dashed border-border-strong" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          onBlur={submit}
          placeholder="Add a task…"
          aria-label={`Add a task to ${bucket.toLowerCase().replace("_", " ")}`}
          className="min-w-0 flex-1 border-none bg-transparent font-mono text-[13px] text-text outline-none placeholder:text-muted"
        />
      </div>
    </div>
  );
}
