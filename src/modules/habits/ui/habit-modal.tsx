"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { userMessage } from "@/core/errors";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { ChipToggle } from "@/core/ui/chip-toggle";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import type { CategoryColor } from "@/modules/calendar/schema";

import {
  cadenceLabel,
  SLOT_LABELS,
  TIME_SLOTS,
  type CadenceInput,
  type HabitTodayView,
  type TimeSlot,
} from "../schema";
import { DayOfWeekPicker } from "./day-of-week-picker";

/**
 * Modal's own display order for the color swatches
 * (design-reference/Ced OS.dc.html CAL_SWATCHES) — deliberately not the same
 * as CATEGORY_COLORS' canonical order, which stays untouched since it's
 * shared with calendar categories.
 */
const SWATCH_ORDER: CategoryColor[] = [
  "blue",
  "violet",
  "green",
  "terracotta",
  "red",
  "warmgray",
  "sky",
  "mauve",
];

const HOW_OFTEN_OPTIONS = [
  { label: "Every day", value: "DAILY" },
  { label: "Certain days", value: "WEEKDAYS" },
  { label: "N× a week", value: "TIMES_PER_WEEK" },
  { label: "Every N days", value: "INTERVAL" },
] as const satisfies ReadonlyArray<{ label: string; value: CadenceInput["cadenceType"] }>;

const MEASURE_OPTIONS = [
  { label: "Just check it off", value: "BINARY" },
  { label: "Count toward a target", value: "COUNT" },
] as const satisfies ReadonlyArray<{ label: string; value: CadenceInput["completionType"] }>;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
      {children}
    </span>
  );
}

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
  const [color, setColor] = useState<CategoryColor>((habit?.color as CategoryColor) ?? "blue");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>(habit?.timeSlot ?? "MORNING");

  const [cadenceType, setCadenceType] = useState<CadenceInput["cadenceType"]>(
    habit?.cadenceType ?? "DAILY",
  );
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(4);
  const [intervalDays, setIntervalDays] = useState(2);

  const [completionType, setCompletionType] = useState<CadenceInput["completionType"]>(
    habit?.completionType ?? "BINARY",
  );
  const [targetValue, setTargetValue] = useState(habit?.targetValue ?? 1);
  const [unit, setUnit] = useState(habit?.unit ?? "");

  const [error, setError] = useState<string | null>(null);

  const accent = `var(--accent-${color})`;

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["habits"] });
    onClose();
  };

  const cadence: CadenceInput = {
    cadenceType,
    weekdays,
    timesPerWeek,
    intervalDays,
    // Interval habits always anchor to the day they're saved — the mockup
    // doesn't expose a start-date field, so this is never user-editable.
    anchorDate: today,
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
    onError: (e) => setError(userMessage(e, "That didn't save.")),
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
      titleVisible={false}
      width={460}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <Input
            variant="ghost"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habit name"
            aria-label="Habit name"
            autoFocus
          />
          <span className="font-mono text-[11px] text-muted">
            {cadenceLabel({ cadenceType, weekdays, timesPerWeek, intervalDays })}
          </span>
        </div>

        <div className="flex flex-col gap-2.25">
          <SectionLabel>Color</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCH_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  "size-6.5 rounded-full border-2",
                  color === option ? "border-text" : "border-transparent",
                )}
                style={{
                  background: `var(--accent-${option})`,
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.25">
          <SectionLabel>Time of day</SectionLabel>
          <ChipToggle
            aria-label="Time of day"
            value={timeSlot}
            onChange={setTimeSlot}
            accent={accent}
            options={TIME_SLOTS.map((slot) => ({ label: SLOT_LABELS[slot], value: slot }))}
          />
        </div>

        <div className="flex flex-col gap-2.25">
          <SectionLabel>How often</SectionLabel>
          <ChipToggle
            aria-label="How often"
            value={cadenceType}
            onChange={setCadenceType}
            accent={accent}
            options={HOW_OFTEN_OPTIONS}
          />

          {cadenceType === "WEEKDAYS" && (
            <DayOfWeekPicker weekdays={weekdays} onChange={setWeekdays} accent={accent} />
          )}

          {cadenceType === "TIMES_PER_WEEK" && (
            <label className="flex items-center gap-2.5">
              <Input
                type="number"
                min={1}
                max={7}
                value={timesPerWeek}
                onChange={(e) => setTimesPerWeek(Number(e.target.value))}
                aria-label="Times per week"
                className="max-w-16"
              />
              <span className="font-mono text-[11.5px] text-muted">times per week</span>
            </label>
          )}

          {cadenceType === "INTERVAL" && (
            <label className="flex items-center gap-2.5">
              <Input
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
                aria-label="Interval days"
                className="max-w-16"
              />
              <span className="font-mono text-[11.5px] text-muted">day interval</span>
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2.25">
          <SectionLabel>Measure</SectionLabel>
          <ChipToggle
            aria-label="Measure"
            value={completionType}
            onChange={setCompletionType}
            accent={accent}
            options={MEASURE_OPTIONS}
          />

          {completionType === "COUNT" && (
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                aria-label="Target"
                className="max-w-17.5"
              />
              <div className="flex-1">
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pages, min, glasses…"
                  aria-label="Unit"
                />
              </div>
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
