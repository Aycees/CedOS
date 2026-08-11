import { z } from "zod";

/** Three fixed buckets — priority horizons, not calendar dates (product spec §5). */
export const TASK_BUCKETS = ["TODAY", "THIS_WEEK", "SOMEDAY"] as const;
export type TaskBucket = (typeof TASK_BUCKETS)[number];

export const BUCKET_LABELS: Record<TaskBucket, string> = {
  TODAY: "Today",
  THIS_WEEK: "This week",
  SOMEDAY: "Someday",
};

export const createTaskSchema = z.object({
  /** Client-generated UUIDv7 — non-negotiable #1. */
  id: z.uuid(),
  title: z.string().trim().min(1, "A task needs a title.").max(500),
  bucket: z.enum(TASK_BUCKETS),
});

export const updateTaskSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "A task needs a title.").max(500).optional(),
  bucket: z.enum(TASK_BUCKETS).optional(),
  /**
   * A3 stores a timestamp rather than a boolean, so the UI sends intent
   * ("mark it done") and the service decides the instant.
   */
  completed: z.boolean().optional(),
});

export const deleteTaskSchema = z.object({ id: z.uuid() });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;

/** The shape the UI renders. Dates cross the wire as ISO strings. */
export type TaskView = {
  id: string;
  title: string;
  bucket: TaskBucket;
  completedAt: string | null;
  /** A3: completed more than 7 days ago, so it collapses behind the toggle. */
  collapsed: boolean;
  sortOrder: number;
};

export type BucketView = {
  bucket: TaskBucket;
  label: string;
  tasks: TaskView[];
  done: number;
  total: number;
};
