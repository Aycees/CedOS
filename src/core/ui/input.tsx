import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * boxed — mono, 1px border, 8px radius; forms and search fields.
 * ghost  — borderless serif at 24px; titles typed inline on the page
 *          (a new note, a new event), where the input *is* the heading.
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
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { variant?: InputVariant }) {
  return (
    <input
      className={cn(
        "w-full bg-transparent text-text outline-none placeholder:text-muted",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-y bg-transparent text-text outline-none placeholder:text-muted",
        VARIANTS.boxed,
        className,
      )}
      {...rest}
    />
  );
}
