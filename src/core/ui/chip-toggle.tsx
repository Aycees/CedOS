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
  options: ReadonlyArray<{ label: string; value: T }>;
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
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="rounded-input border px-3 py-1.75 font-mono text-[11.5px] text-text"
            style={{
              borderColor: selected ? accent : "var(--border)",
              background: selected ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
