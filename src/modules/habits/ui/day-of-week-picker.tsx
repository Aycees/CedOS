"use client";

import { cn } from "@/core/ui/cn";

/** Sunday-first display order; values are still ISO weekdays (1=Mon..7=Sun). */
const DAYS: ReadonlyArray<{ label: string; iso: number }> = [
  { label: "S", iso: 7 },
  { label: "M", iso: 1 },
  { label: "T", iso: 2 },
  { label: "W", iso: 3 },
  { label: "T", iso: 4 },
  { label: "F", iso: 5 },
  { label: "S", iso: 6 },
];

/**
 * "Certain days" weekday selector. The one control in the habit modal where
 * selection flips to a solid fill of the habit's own color rather than the
 * translucent chip tint used elsewhere (design-reference/Ced OS.dc.html,
 * `draftDays`).
 */
export function DayOfWeekPicker({
  weekdays,
  onChange,
  accent,
}: {
  weekdays: number[];
  onChange: (weekdays: number[]) => void;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {DAYS.map(({ label, iso }, index) => {
        const on = weekdays.includes(iso);
        return (
          <button
            key={`${iso}-${index}`}
            type="button"
            aria-label={`day ${iso}`}
            aria-pressed={on}
            onClick={() =>
              onChange(on ? weekdays.filter((d) => d !== iso) : [...weekdays, iso])
            }
            className={cn(
              "size-8 rounded-full border font-mono text-[11.5px]",
              !on && "border-border text-muted",
            )}
            style={
              on
                ? { borderColor: accent, background: accent, color: "var(--on-dark)" }
                : undefined
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
