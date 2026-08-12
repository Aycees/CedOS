import type { HTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Pill-shaped tag. `color` drives the leading dot only — the chip body stays
 * neutral so a row of category chips reads as one family rather than a
 * rainbow (design-reference/components/core/Chip.jsx).
 */
export function Chip({
  color,
  dot = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { color?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-border",
        "bg-[color-mix(in_srgb,var(--text)_5%,transparent)]",
        "px-3.5 py-[7px] font-mono text-[11.5px] text-text",
        className,
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className="size-[7px] flex-none rounded-full"
          style={{ background: color ?? "var(--accent-default)" }}
        />
      )}
      {children}
    </span>
  );
}
