"use client";

import { cn } from "./cn";

/**
 * Two-to-three-way switch: Day/Night theme, Comfortable/Compact density,
 * Markdown/Preview. The selected segment lifts to the card colour against a
 * tinted track (design-reference/components/core/Segmented.jsx).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex w-fit rounded-lg p-0.75",
        "bg-[color-mix(in_srgb,var(--text)_7%,transparent)]",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md border-none px-3.25 py-1.5 font-mono text-[11.5px]",
              selected ? "bg-card text-text" : "bg-transparent text-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
