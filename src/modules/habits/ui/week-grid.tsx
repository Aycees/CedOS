"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { cn } from "@/core/ui/cn";

import { addDays, weekBounds } from "../engine/cadence";
import type { HabitHistoryView, HabitTodayView } from "../schema";

/**
 * The day-card's "week" mode — a compact habit-rows × day-columns grid
 * (design-reference/Ced OS.dc.html, `weekCols`/`weekRows`). Sunday-anchored,
 * matching the day-of-week picker's convention elsewhere in this module.
 *
 * Rows come from `habits` (today's due set, so completionType/target are on
 * hand for logging); the other six days' completion state is read from the
 * same history query the History tab already uses — no new endpoint needed,
 * and identical query keys mean the two views share one cache entry.
 */
export function WeekGrid({
  habits,
  today,
  onEdit,
}: {
  habits: HabitTodayView[];
  today: string;
  onEdit: (habit: HabitTodayView) => void;
}) {
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: ["habits", "history", today],
    queryFn: () => api.get<HabitHistoryView[]>(`/api/habits?view=history&today=${today}`),
  });

  const { start } = weekBounds(today, 7);
  const columns = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const toggle = useMutation({
    mutationFn: (vars: { habit: HabitTodayView; date: string; done: boolean }) =>
      vars.done
        ? api.delete("/api/habits/logs", { habitId: vars.habit.id, logDate: vars.date })
        : api.post("/api/habits/logs", {
            id: newId(),
            habitId: vars.habit.id,
            logDate: vars.date,
            status: "LOGGED",
            value: vars.habit.completionType === "COUNT" ? vars.habit.targetValue : null,
          }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habits"] }),
  });

  const cellFor = (habit: HabitTodayView, date: string) => {
    if (date === today) {
      return { due: true, progress: habit.progress, status: habit.status };
    }
    const row = history.find((entry) => entry.id === habit.id);
    return row?.cells.find((cell) => cell.date === date) ?? { due: false, progress: 0, status: null };
  };

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="min-w-105">
        <div className="flex items-end border-b border-dashed border-border pb-2.5">
          <div className="w-42 flex-none" />
          {columns.map((date) => {
            const isToday = date === today;
            return (
              <div
                key={date}
                className={cn(
                  "flex-1 text-center font-mono text-[10px] tracking-[0.08em]",
                  isToday ? "font-semibold text-text" : "text-muted",
                )}
              >
                <div>{DateTime.fromFormat(date, "yyyy-MM-dd", { zone: "utc" }).toFormat("ccc")}</div>
                <div className={cn("mt-1.25 font-mono text-[12px]", isToday ? "text-text" : "text-muted")}>
                  {DateTime.fromFormat(date, "yyyy-MM-dd", { zone: "utc" }).toFormat("d")}
                </div>
              </div>
            );
          })}
        </div>

        {habits.map((habit) => {
          const accent = `var(--accent-${habit.color})`;
          return (
            <div key={habit.id} className="flex items-center py-1.5">
              <button
                type="button"
                onClick={() => onEdit(habit)}
                aria-label={`Edit ${habit.name}`}
                className="flex w-42 flex-none items-center gap-2.25 text-left"
              >
                <span aria-hidden className="size-2 flex-none rounded-full" style={{ background: accent }} />
                <span className="truncate font-mono text-[13.5px] text-text">{habit.name}</span>
              </button>

              {columns.map((date) => {
                const future = date > today;
                const isTodayCol = date === today;
                const cell = cellFor(habit, date);
                const progress = cell.progress ?? 0;
                const skipped = cell.status === "SKIPPED";
                const done = progress >= 1;

                return (
                  <button
                    key={date}
                    type="button"
                    disabled={future}
                    onClick={() => toggle.mutate({ habit, date, done })}
                    aria-label={`${habit.name} on ${date}`}
                    className={cn(
                      "mx-0.5 h-8.5 flex-1 rounded-input font-mono text-[12px]",
                      future && "cursor-default opacity-40",
                    )}
                    style={{
                      border: isTodayCol
                        ? "1.5px solid var(--border-strong)"
                        : cell.due || future
                          ? "1px solid var(--border)"
                          : "1px solid transparent",
                      background:
                        progress > 0
                          ? `color-mix(in srgb, ${accent} ${Math.min(100, Math.round(progress * 100))}%, transparent)`
                          : cell.due || future
                            ? "color-mix(in srgb, var(--text) 4%, transparent)"
                            : "transparent",
                      color: progress >= 0.55 ? "var(--on-dark)" : "var(--muted)",
                    }}
                  >
                    {skipped ? "–" : done ? "✓" : ""}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
