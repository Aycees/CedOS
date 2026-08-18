import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * boxed — mono, 1px border, 8px radius; forms and search fields.
 * ghost  — borderless serif at 24px; titles typed inline on the page
 *          (a new note, a new event), where the input *is* the heading.
 * tinted — boxed with a faint fill (`bg-text/5`) instead of transparent;
 *          the mockup's date/time trigger fields.
 *
 * design-reference/components/core/Input.prompt.md
 */
const VARIANTS = {
  boxed:
    "rounded-input border border-border px-2.75 py-2 font-mono text-[12.5px]",
  ghost: "border-none p-0 font-serif text-[24px] tracking-[-0.015em]",
} as const;

export type InputVariant = keyof typeof VARIANTS;

export function Input({
  variant = "boxed",
  tinted = false,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { variant?: InputVariant; tinted?: boolean }) {
  return (
    <input
      className={cn(
        "w-full text-text outline-none placeholder:text-muted",
        tinted ? "bg-text/5" : "bg-transparent",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Textarea({
  tinted = false,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { tinted?: boolean }) {
  return (
    <textarea
      className={cn(
        "w-full resize-y text-text outline-none placeholder:text-muted",
        tinted ? "bg-text/5" : "bg-transparent",
        VARIANTS.boxed,
        className,
      )}
      {...rest}
    />
  );
}
