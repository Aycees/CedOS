"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { EmptyState } from "@/core/ui/page-header";
import { Segmented } from "@/core/ui/segmented";

import {
  SLOT_LABELS,
  TIME_SLOTS,
  type HabitHistoryView,
  type HabitTodayView,
} from "../schema";
import { HabitModal } from "./habit-modal";

export function HabitsPage({
  initialToday,
  today,
}: {
  initialToday: HabitTodayView[];
  today: string;
}) {
  const [view, setView] = useState<"today" | "history">("today");
  const [editing, setEditing] = useState<HabitTodayView | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: habits = initialToday } = useQuery({
    queryKey: ["habits", "today", today],
    queryFn: () => api.get<HabitTodayView[]>(`/api/habits?today=${today}`),
    initialData: initialToday,
  });

  /*
   * Derived from the same query that renders the list, rather than passed in
   * from the server. A separately-fetched summary goes stale the moment a
   * habit is ticked — the counts and the rows must come from one source.
   */
  const summary = {
    dueToday: habits.length,
    doneToday: habits.filter((habit) => habit.progress >= 1).length,
    bestOverall: habits.reduce((best, habit) => Math.max(best, habit.bestStreak), 0),
  };

  return (
    <div className="p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => setCreating(true)}>+ new habit</Button>

        <Segmented
          aria-label="Habits view"
          value={view}
          onChange={setView}
          options={[
            { label: "Today", value: "today" },
            { label: "History", value: "history" },
          ]}
        />

        <div className="ml-auto flex items-center gap-5 font-mono text-[11px] text-muted">
          <span>
            <span className="kicker mr-1.5">Done</span>
            {summary.doneToday}/{summary.dueToday}
          </span>
          <span>
            <span className="kicker mr-1.5">Longest</span>
            {summary.bestOverall}
          </span>
        </div>
      </div>

      {view === "today" ? (
        <TodayView habits={habits} today={today} onEdit={setEditing} onNew={() => setCreating(true)} />
      ) : (
        <HistoryView today={today} />
      )}

      {(creating || editing) && (
        <HabitModal
          habit={editing}
          today={today}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TodayView({
  habits,
  today,
  onEdit,
  onNew,
}: {
  habits: HabitTodayView[];
  today: string;
  onEdit: (habit: HabitTodayView) => void;
  onNew: () => void;
}) {
  if (habits.length === 0) {
    return (
      <EmptyState
        line="nothing due today"
        action={
          <Button variant="dashed" className="w-full" onClick={onNew}>
            + new habit
          </Button>
        }
      />
    );
  }

  // Grouped by time-of-day slot (product spec §8).
  const bySlot = TIME_SLOTS.map((slot) => ({
    slot,
    habits: habits.filter((habit) => habit.timeSlot === slot),
  })).filter((group) => group.habits.length > 0);

  return (
    <div className="flex max-w-180 flex-col gap-4.5">
      {bySlot.map((group) => (
        <Card key={group.slot} className="pb-3">
          <div className="kicker mb-1">{SLOT_LABELS[group.slot]}</div>
          {group.habits.map((habit) => (
            <HabitRow key={habit.id} habit={habit} today={today} onEdit={onEdit} />
          ))}
        </Card>
      ))}
    </div>
  );
}

function HabitRow({
  habit,
  today,
  onEdit,
}: {
  habit: HabitTodayView;
  today: string;
  onEdit: (habit: HabitTodayView) => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(habit.value ?? ""));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["habits"] });

  const log = useMutation({
    mutationFn: (vars: { status: "LOGGED" | "SKIPPED"; value: number | null }) =>
      api.post("/api/habits/logs", {
        id: newId(),
        habitId: habit.id,
        logDate: today,
        ...vars,
      }),
    onSuccess: invalidate,
  });

  const clear = useMutation({
    mutationFn: () =>
      api.delete("/api/habits/logs", { habitId: habit.id, logDate: today }),
    onSuccess: invalidate,
  });

  const done = habit.progress >= 1;
  const skipped = habit.status === "SKIPPED";

  return (
    <div className="row-divider list-row flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        onClick={() =>
          done || skipped
            ? clear.mutate()
            : habit.completionType === "BINARY"
              ? log.mutate({ status: "LOGGED", value: null })
              : log.mutate({ status: "LOGGED", value: habit.targetValue })
        }
        className={cn(
          "grid size-4.25 flex-none place-items-center rounded-sm border-[1.5px] font-mono text-[10px] leading-none",
          done ? "text-on-dark" : "border-checkbox",
        )}
        style={done ? { background: `var(--accent-${habit.color})`, borderColor: `var(--accent-${habit.color})` } : undefined}
      >
        {done ? "✓" : ""}
      </button>

      <button
        type="button"
        onClick={() => onEdit(habit)}
        aria-label={`Edit ${habit.name}`}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={cn(
            "block font-mono text-[13px]",
            done && "text-muted line-through",
            skipped && "text-muted",
          )}
        >
          {habit.name}
        </span>
        <span className="block font-mono text-[10.5px] text-muted">
          {habit.cadenceLabel}
          {habit.currentStreak > 0 && ` · ${habit.currentStreak} day streak`}
          {/*
            A5: an N-per-week habit only says "needed today" when the target
            becomes unreachable otherwise. Status without scolding.
          */}
          {habit.cadenceType === "TIMES_PER_WEEK" && habit.pace === "NEEDED_TODAY" && !done &&
            " · needed today"}
          {/* Only meaningful for a weekly target — a daily habit is never
              "met this week", it is simply done or not. */}
          {habit.cadenceType === "TIMES_PER_WEEK" && habit.pace === "MET" &&
            " · met this week"}
          {skipped && " · skipped"}
        </span>
      </button>

      {habit.completionType === "COUNT" && !done && !skipped && (
        <div className="flex flex-none items-center gap-1.5">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Amount for ${habit.name}`}
            className="w-16 rounded-input border border-border bg-transparent px-2 py-1 font-mono text-[11.5px] text-text outline-none"
          />
          <span className="font-mono text-[10.5px] text-muted">
            /{habit.targetValue} {habit.unit}
          </span>
          <Button
            size="sm"
            variant="outline"
            aria-label={`Log ${habit.name}`}
            onClick={() => log.mutate({ status: "LOGGED", value: Number(amount || 0) })}
          >
            log it
          </Button>
        </div>
      )}

      {/* Partial credit reads as progress rather than as failure. */}
      {habit.completionType === "COUNT" && habit.progress > 0 && !done && (
        <span className="flex-none font-mono text-[10.5px] text-muted">
          {Math.round(habit.progress * 100)}%
        </span>
      )}

      {done && habit.completionType === "COUNT" && (
        <span className="flex-none font-mono text-[10.5px] text-muted">
          {habit.value} {habit.unit} · {Math.round(habit.progress * 100)}%
        </span>
      )}

      {!done && !skipped && (
        <button
          type="button"
          onClick={() => log.mutate({ status: "SKIPPED", value: null })}
          aria-label={`Skip ${habit.name}`}
          className="flex-none font-mono text-[10.5px] text-muted"
        >
          skip
        </button>
      )}
    </div>
  );
}

function HistoryView({ today }: { today: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["habits", "history", today],
    queryFn: () =>
      api.get<HabitHistoryView[]>(`/api/habits?view=history&today=${today}`),
  });

  if (rows.length === 0) {
    return <EmptyState line="no history yet" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <Card key={row.id}>
          <div className="mb-2.5 flex items-baseline gap-2.5">
            <span
              aria-hidden
              className="size-2 flex-none rounded-full"
              style={{ background: `var(--accent-${row.color})` }}
            />
            <h2 className="m-0 font-serif text-[16px] font-normal">{row.name}</h2>
            <span className="ml-auto font-mono text-[10.5px] text-muted">
              streak {row.currentStreak} · longest {row.bestStreak}
            </span>
          </div>

          <div className="flex flex-wrap gap-0.75">
            {row.cells.map((cell) => (
              <span
                key={cell.date}
                title={`${cell.date}${cell.due ? "" : " · not due"}`}
                className={cn(
                  "size-2.75 rounded-xs",
                  !cell.due && "opacity-25",
                )}
                style={{
                  background: cell.due
                    ? cell.status === "SKIPPED"
                      ? "var(--dot)"
                      : cell.progress > 0
                        ? `color-mix(in srgb, var(--accent-${row.color}) ${Math.min(100, Math.round(cell.progress * 100))}%, transparent)`
                        : "var(--dot)"
                    : "transparent",
                  border: cell.due ? "none" : "1px solid var(--border)",
                }}
              />
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 font-mono text-[10.5px] text-muted">
            <span>less</span>
            {[0.2, 0.4, 0.6, 0.8, 1].map((step) => (
              <span
                key={step}
                className="size-2.25 rounded-xs"
                style={{
                  background: `color-mix(in srgb, var(--accent-${row.color}) ${step * 100}%, transparent)`,
                }}
              />
            ))}
            <span>more</span>
            <span className="ml-auto">12 weeks</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
