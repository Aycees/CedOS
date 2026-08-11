import "server-only";

import { prisma } from "@/core/db/client";
import { assertOwned, live, softDeleted } from "@/core/db/scope";
import { isOlderThanDays } from "@/core/date";

import {
  BUCKET_LABELS,
  TASK_BUCKETS,
  type BucketView,
  type CreateTaskInput,
  type DeleteTaskInput,
  type TaskView,
  type UpdateTaskInput,
} from "./schema";

/** The only place in this module that touches Prisma (decision log §7). */

export async function listBuckets(
  userId: string,
  timezone: string,
): Promise<BucketView[]> {
  const tasks = await prisma.task.findMany({
    where: live(userId),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return TASK_BUCKETS.map((bucket) => {
    const inBucket = tasks
      .filter((task) => task.bucket === bucket)
      .map((task) => toView(task, timezone));

    return {
      bucket,
      label: BUCKET_LABELS[bucket],
      tasks: inBucket,
      done: inBucket.filter((t) => t.completedAt).length,
      total: inBucket.length,
    };
  });
}

/** Sidebar badge: open (incomplete) tasks across every bucket. */
export async function countOpenTasks(userId: string): Promise<number> {
  return prisma.task.count({ where: live(userId, { completedAt: null }) });
}

export async function createTask(userId: string, input: CreateTaskInput) {
  // Appending rather than prepending: a list the user is adding to should
  // grow downward, and sortOrder exists so manual reordering is additive
  // later without backfilling positions.
  const last = await prisma.task.findFirst({
    where: live(userId, { bucket: input.bucket }),
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.task.create({
    data: {
      id: input.id,
      userId,
      title: input.title,
      bucket: input.bucket,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateTask(userId: string, input: UpdateTaskInput) {
  const existing = await prisma.task.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "task");

  return prisma.task.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.bucket !== undefined ? { bucket: input.bucket } : {}),
      // A3: completion is a timestamp. Re-opening a task clears it rather
      // than recording a second state.
      ...(input.completed !== undefined
        ? { completedAt: input.completed ? new Date() : null }
        : {}),
    },
  });
}

/**
 * Soft delete. Product spec §5 is explicit that completed tasks are never
 * auto-removed — the user removes them, and even then the row survives as a
 * tombstone so the action is recoverable.
 */
export async function deleteTask(userId: string, input: DeleteTaskInput) {
  const existing = await prisma.task.findUnique({ where: { id: input.id } });
  assertOwned(existing, userId, "task");

  await prisma.task.update({ where: { id: input.id }, data: softDeleted() });
}

type TaskRow = {
  id: string;
  title: string;
  bucket: string;
  completedAt: Date | null;
  sortOrder: number;
};

function toView(task: TaskRow, timezone: string): TaskView {
  return {
    id: task.id,
    title: task.title,
    bucket: task.bucket as TaskView["bucket"],
    completedAt: task.completedAt?.toISOString() ?? null,
    // A3: still visible and struck through, but folded behind the
    // "show completed" toggle once it is a week old.
    collapsed: task.completedAt
      ? isOlderThanDays(task.completedAt, timezone, 7)
      : false,
    sortOrder: task.sortOrder,
  };
}
