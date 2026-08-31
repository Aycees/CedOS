"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { formatWeekdayName } from "@/core/date";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { PageHeader } from "@/core/ui/page-header";
import { Segmented } from "@/core/ui/segmented";

import { SLOT_LABELS, TIME_SLOTS, type HabitTodayView } from "../schema";
import { HabitModal } from "./habit-modal";
import { HistoryView } from "./history-view";
import { StatTile } from "./stat-tile";
import { WeekGrid } from "./week-grid";

export function HabitsPage({
  initialToday,
  today,
}: {
  initialToday: HabitTodayView[];
  today: string;
}) {
  const [editing, setEditing] = useState<HabitTodayView | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: habits = initialToday } = useQuery({
    queryKey: ["habits", "today", today],
    queryFn: () => api.get<HabitTodayView[]>(`/api/habits?today=${today}`),
    initialData: initialToday,
  });

  const dueToday = habits.length;
  const doneToday = habits.filter((habit) => habit.progress >= 1).length;

  return (
    <>
      <PageHeader
        kicker={`HABITS · ${doneToday} OF ${dueToday} DONE TODAY`}
        title="Habits"
        actions={<Button onClick={() => setCreating(true)}>+ new habit</Button>}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <TodayView
            habits={habits}
            today={today}
            onEdit={setEditing}
            onNew={() => setCreating(true)}
          />
        </div>
      </div>

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
    </>
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
  const dueToday = habits.length;
  const doneToday = habits.filter((habit) => habit.progress >= 1).length;
  const skipToday = habits.filter((habit) => habit.status === "SKIPPED").length;
  const ratio = dueToday > 0 ? doneToday / dueToday : 0;

  const bestHabit = habits.reduce<HabitTodayView | null>(
    (best, habit) => (best === null || habit.bestStreak > best.bestStreak ? habit : best),
    null,
  );
  const bestStreak = bestHabit?.bestStreak ?? 0;

  const rate7 =
    dueToday > 0
      ? Math.round((habits.reduce((sum, habit) => sum + habit.weekRate, 0) / dueToday) * 100)
      : 0;

  return (
    <div className="flex max-w-265 flex-col gap-4.5">
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
        <StatTile
          label="Done today"
          value={`${doneToday}/${dueToday}`}
          unit={skipToday > 0 ? `${skipToday} skipped` : "habits due"}
          progress={ratio}
          color="var(--accent-default)"
        />
        <StatTile
          label="Best streak"
          value={String(bestStreak)}
          unit={
            bestHabit
              ? `${bestHabit.cadenceType === "TIMES_PER_WEEK" ? "wks" : "days"} · ${bestHabit.name.toLowerCase()}`
              : "no streak yet"
          }
          progress={Math.min(1, bestStreak / 30)}
          color={bestHabit ? `var(--accent-${bestHabit.color})` : "var(--accent-default)"}
        />
        <StatTile
          label="Last 7 days"
          value={`${rate7}%`}
          unit="completed"
          progress={rate7 / 100}
          color="var(--accent-green)"
        />
      </div>

      <DayCard habits={habits} today={today} onEdit={onEdit} onNew={onNew} />

      <HistoryView today={today} />
    </div>
  );
}

function DayCard({
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
  const [mode, setMode] = useState<"today" | "week">("today");
  const dueToday = habits.length;
  const doneToday = habits.filter((habit) => habit.progress >= 1).length;

  const bySlot = TIME_SLOTS.map((slot) => ({
    slot,
    habits: habits.filter((habit) => habit.timeSlot === slot),
  })).filter((group) => group.habits.length > 0);

  return (
    <Card>
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <h2 className="m-0 font-serif text-[19px] font-normal">{formatWeekdayName(today)}</h2>
        <span className="font-mono text-[10.5px] text-muted">
          {doneToday} of {dueToday} done
        </span>
        <Segmented
          className="ml-auto"
          aria-label="Day view"
          value={mode}
          onChange={setMode}
          options={[
            { label: "today", value: "today" },
            { label: "week", value: "week" },
          ]}
        />
      </div>

      {mode === "today" ? (
        habits.length === 0 ? (
          <div className="py-9 text-center">
            <p className="m-0 font-mono text-[12px] leading-relaxed text-muted">nothing due today</p>
            <Button variant="dashed" className="mt-3.5" onClick={onNew}>
              + add a habit
            </Button>
          </div>
        ) : (
          bySlot.map((group) => (
            <div key={group.slot} className="mt-4.5">
              <div className="mb-0.5 flex items-center gap-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  {SLOT_LABELS[group.slot]}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {group.habits.map((habit) => (
                <HabitRow key={habit.id} habit={habit} today={today} onEdit={onEdit} />
              ))}
            </div>
          ))
        )
      ) : (
        <WeekGrid habits={habits} today={today} onEdit={onEdit} />
      )}
    </Card>
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
  const queryKey = ["habits", "today", today];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["habits"] });

  const log = useMutation({
    mutationFn: (vars: { status: "LOGGED" | "SKIPPED"; value: number | null }) =>
      api.post("/api/habits/logs", {
        id: newId(),
        habitId: habit.id,
        logDate: today,
        ...vars,
      }),
  });

  const clear = useMutation({
    mutationFn: () => api.delete("/api/habits/logs", { habitId: habit.id, logDate: today }),
    onSuccess: invalidate,
  });

  // Counter clicks update the cache instantly and coalesce the network write:
  // logHabit upserts by (habitId, logDate), so only the value after the last
  // click in a burst needs to reach the server.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const bumpCount = (delta: number) => {
    // Compute the new value from the live cache inside the updater, not from
    // the `habit` render closure - rapid clicks can fire faster than React
    // re-renders, so reading habit.value here would make every click in a
    // burst compute off the same stale number instead of accumulating.
    let nextValue = 0;
    queryClient.setQueryData<HabitTodayView[]>(queryKey, (old) =>
      old?.map((h) => {
        if (h.id !== habit.id) return h;
        nextValue = Math.max(0, (h.value ?? 0) + delta);
        return {
          ...h,
          value: nextValue,
          status: "LOGGED",
          progress: h.targetValue ? nextValue / h.targetValue : 0,
        };
      }),
    );

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const myId = ++fireIdRef.current;
      log.mutate(
        { status: "LOGGED", value: nextValue },
        {
          onSettled: (_data, error) => {
            // Only the most recently fired request may reconcile the cache -
            // an older, slower response settling later must not clobber a
            // newer optimistic value with stale server state.
            if (error || myId === fireIdRef.current) invalidate();
          },
        },
      );
    }, 400);
  };

  const done = habit.progress >= 1;
  const skipped = habit.status === "SKIPPED";
  const accent = `var(--accent-${habit.color})`;
  const weekly = habit.cadenceType === "TIMES_PER_WEEK";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.75">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        onClick={() =>
          done || skipped
            ? clear.mutate()
            : log.mutate(
                {
                  status: "LOGGED",
                  value: habit.completionType === "BINARY" ? null : habit.targetValue,
                },
                { onSettled: invalidate },
              )
        }
        className={cn(
          "grid size-6 flex-none place-items-center rounded-input border-[1.5px] font-mono text-[12px] leading-none text-on-dark",
          !done && "border-checkbox",
        )}
        style={done ? { background: accent, borderColor: accent } : undefined}
      >
        {done ? "✓" : skipped ? "–" : ""}
      </button>

      <button
        type="button"
        onClick={() => onEdit(habit)}
        aria-label={`Edit ${habit.name}`}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2.25">
          <span aria-hidden className="size-2 flex-none rounded-full" style={{ background: accent }} />
          <span
            className={cn(
              "font-mono text-[14.5px] text-text",
              done && "text-muted line-through opacity-55",
            )}
          >
            {habit.name}
          </span>
        </div>
        <span className="mt-0.75 block pl-4.25 font-mono text-[11px] leading-relaxed text-muted">
          {habit.cadenceLabel}
          {habit.completionType === "COUNT" && ` · ${habit.targetValue} ${habit.unit ?? ""}`}
          {skipped && " · rest day"}
        </span>
      </button>

      {habit.completionType === "COUNT" && !skipped && (
        <div className="flex flex-none items-center gap-1.5">
          <button
            type="button"
            aria-label={`Decrease ${habit.name}`}
            onClick={() => bumpCount(-1)}
            className="size-6 flex-none rounded-[7px] border border-border font-mono text-[13px] text-text"
          >
            −
          </button>
          <span className="min-w-10.5 flex-none text-center font-mono text-[11.5px] text-muted">
            {habit.value ?? 0}/{habit.targetValue}
          </span>
          <button
            type="button"
            aria-label={`Increase ${habit.name}`}
            onClick={() => bumpCount(1)}
            className="size-6 flex-none rounded-[7px] border border-border font-mono text-[13px] text-text"
          >
            +
          </button>
        </div>
      )}

      <span
        className="min-w-8.5 flex-none rounded-pill px-2 py-1 text-center font-mono text-[11px]"
        style={{
          color: habit.currentStreak > 0 ? accent : "var(--muted)",
          background:
            habit.currentStreak > 0 ? `color-mix(in srgb, ${accent} 10%, transparent)` : "transparent",
        }}
      >
        {habit.currentStreak > 0 ? `${habit.currentStreak}${weekly ? "w" : "d"}` : "—"}
      </span>

      {!done && (
        <button
          type="button"
          onClick={() =>
            skipped
              ? clear.mutate()
              : log.mutate({ status: "SKIPPED", value: null }, { onSettled: invalidate })
          }
          aria-label={skipped ? `Unskip ${habit.name}` : `Skip ${habit.name}`}
          className="flex-none font-mono text-[10.5px] tracking-[0.03em]"
          style={{ color: skipped ? accent : "var(--muted)" }}
        >
          skip
        </button>
      )}
    </div>
  );
}
