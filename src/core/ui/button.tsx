import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

export type ButtonVariant = "solid" | "outline" | "ghost" | "dashed";
export type ButtonSize = "sm" | "md";

/**
 * Ported from design-reference/components/core/Button.jsx.
 *
 * - solid   — the single primary action on a screen (accent fill)
 * - ghost   — inline mono text links, "open calendar →"
 * - outline — secondary modal actions, "cancel"
 * - dashed  — empty-state "add" prompts
 *
 * Sizes and padding are the reference values exactly: sm 7px/12px at 11.5px,
 * md 10px/16px at 12px. Ghost drops to a 4px hit-pad because it reads as text.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  solid: "bg-accent text-on-dark",
  outline: "border border-border text-text",
  ghost: "text-accent",
  /*
   * Not `w-full`: a dashed prompt is sometimes a full-width block (an empty
   * state) and sometimes a tile sitting among others (the account row in
   * Money). Two Tailwind width utilities have equal specificity, so a
   * variant-level `w-full` cannot be overridden from the call site — it has
   * to be opted into instead.
   */
  dashed: "border border-dashed border-border-strong text-muted text-left rounded-[8px]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-[11.5px] px-3 py-[7px]",
  md: "text-[12px] px-4 py-[10px]",
};

const GHOST_SIZES: Record<ButtonSize, string> = {
  sm: "text-[11.5px] p-1",
  md: "text-[12px] px-1.5 py-1",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "solid",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control font-mono",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "ghost" ? GHOST_SIZES[size] : SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}
