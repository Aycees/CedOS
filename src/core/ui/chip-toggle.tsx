"use client";

import { cn } from "./cn";

/**
 * A row of independently-bordered toggle chips — distinct from `Segmented`,
 * which lifts one option out of a shared tinted track. Here each option
 * carries its own border and, when selected, a tinted fill of `accent`
 * (design-reference/Ced OS.dc.html — the habit modal's `chip()` helper).
 */
export function ChipToggle<T extends string>({
  options,
  value,
  onChange,
  accent = "var(--accent-default)",
  className,
  "aria-label": ariaLabel,
}: {
  /** Per-option `color` overrides the group's `accent` — e.g. vault categories, where each option has its own fixed color. */
  options: ReadonlyArray<{ label: string; value: T; color?: string }>;
  value: T;
  onChange: (value: T) => void;
  accent?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.75", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        const optionAccent = option.color ?? accent;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="rounded-input border px-3 py-1.75 font-mono text-[11.5px] text-text"
            style={{
              borderColor: selected ? optionAccent : "var(--border)",
              background: selected ? `color-mix(in srgb, ${optionAccent} 12%, transparent)` : "transparent",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
