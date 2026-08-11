"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppError } from "@/core/errors";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { Segmented } from "@/core/ui/segmented";
import { CATEGORY_COLORS } from "@/modules/calendar/schema";

import {
  SLOT_LABELS,
  TIME_SLOTS,
  type CadenceInput,
  type HabitTodayView,
  type TimeSlot,
} from "../schema";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function HabitModal({
  habit,
  today,
  onClose,
}: {
  habit: HabitTodayView | null;
  today: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(habit?.name ?? "");
  const [color, setColor] = useState(habit?.color ?? "green");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>(habit?.timeSlot ?? "ANYTIME");

  const [cadenceType, setCadenceType] =
    useState<CadenceInput["cadenceType"]>("DAILY");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(4);
  const [intervalDays, setIntervalDays] = useState(2);
  const [anchorDate, setAnchorDate] = useState(today);

  const [completionType, setCompletionType] =
    useState<CadenceInput["completionType"]>(habit?.completionType ?? "BINARY");
  const [targetValue, setTargetValue] = useState(habit?.targetValue ?? 8);
  const [unit, setUnit] = useState(habit?.unit ?? "");

  const [error, setError] = useState<string | null>(null);

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["habits"] });
    onClose();
  };

  const cadence: CadenceInput = {
    cadenceType,
    weekdays,
    timesPerWeek,
    intervalDays,
    anchorDate,
    completionType,
    targetValue: completionType === "COUNT" ? Number(targetValue) : null,
    unit: completionType === "COUNT" ? unit || null : null,
  };

  const save = useMutation({
    mutationFn: () =>
      habit
        ? api.patch("/api/habits", {
            id: habit.id,
            name,
            color,
            timeSlot,
            // Sending a cadence opens a new schedule version (A6) rather
            // than rewriting the one history was measured against.
            scheduleId: newId(),
            today,
            cadence,
          })
        : api.post("/api/habits", {
            id: newId(),
            scheduleId: newId(),
            name,
            color,
            timeSlot,
            today,
            cadence,
          }),
    onSuccess: done,
    onError: (e) => setError(e instanceof AppError ? e.message : "That didn't save."),
  });

  const archive = useMutation({
    mutationFn: () =>
      api.patch("/api/habits/archive", {
        id: habit!.id,
        archived: !habit!.archivedAt,
        today,
      }),
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: () => api.delete("/api/habits", { id: habit!.id }),
    onSuccess: done,
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={habit ? "EDIT HABIT" : "NEW HABIT"}
      title={habit ? "Edit habit" : "New habit"}
      width={480}
    >
      <div className="mt-5 flex flex-col gap-4">
        <Input
          variant="ghost"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name"
          aria-label="Habit name"
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <span className="kicker">Color</span>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  "size-6 rounded-full border-2",
                  color === option ? "border-text" : "border-transparent",
                )}
                style={{ background: `var(--accent-${option})` }}
              />
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Time of day</span>
          <select
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}
            className="w-full rounded-input border border-border bg-transparent px-[11px] py-2 font-mono text-[12.5px] text-text outline-none"
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {SLOT_LABELS[slot]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="kicker">How often</span>
          <Segmented
            aria-label="How often"
            value={cadenceType}
            onChange={setCadenceType}
            options={[
              { label: "Daily", value: "DAILY" },
              { label: "By day", value: "WEEKDAYS" },
              { label: "N/week", value: "TIMES_PER_WEEK" },
              { label: "Interval", value: "INTERVAL" },
            ]}
          />

          {cadenceType === "WEEKDAYS" && (
            <div className="flex items-center gap-1.5">
              {WEEKDAY_LABELS.map((label, index) => {
                const day = index + 1;
                const on = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={`day ${day}`}
                    aria-pressed={on}
                    onClick={() =>
                      setWeekdays((current) =>
                        current.includes(day)
                          ? current.filter((d) => d !== day)
                          : [...current, day],
                      )
                    }
                    className={cn(
                      "size-8 rounded-[8px] border font-mono text-[11.5px]",
                      on ? "border-accent bg-accent text-on-dark" : "border-border text-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {cadenceType === "TIMES_PER_WEEK" && (
            <label className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={7}
                value={timesPerWeek}
                onChange={(e) => setTimesPerWeek(Number(e.target.value))}
                aria-label="Times per week"
                className="max-w-[80px]"
              />
              <span className="font-mono text-[11.5px] text-muted">times a week</span>
            </label>
          )}

          {cadenceType === "INTERVAL" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11.5px] text-muted">every</span>
              <Input
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
                aria-label="Interval days"
                className="max-w-[80px]"
              />
              <span className="font-mono text-[11.5px] text-muted">days from</span>
              <Input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                aria-label="Anchor date"
                className="max-w-[160px]"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="kicker">Measure</span>
          <Segmented
            aria-label="Measure"
            value={completionType}
            onChange={setCompletionType}
            options={[
              { label: "Done / not done", value: "BINARY" },
              { label: "Count", value: "COUNT" },
            ]}
          />

          {completionType === "COUNT" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                aria-label="Target"
                className="max-w-[90px]"
              />
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="glasses, min, pages"
                aria-label="Unit"
                className="max-w-[180px]"
              />
            </div>
          )}
        </div>

        {habit && (
          <p className="m-0 font-mono text-[11px] leading-relaxed text-muted">
            changing the cadence or target starts a new version — past days keep
            being scored against what they were set to at the time
          </p>
        )}

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
      </div>

      <ModalActions
        destructive={
          habit ? (
            <>
              <Button variant="outline" onClick={() => archive.mutate()}>
                {habit.archivedAt ? "unarchive" : "archive"}
              </Button>
              <Button variant="outline" onClick={() => remove.mutate()}>
                delete
              </Button>
            </>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}
