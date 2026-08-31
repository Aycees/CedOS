"use client";

import * as RadixSelect from "@radix-ui/react-select";
import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * Replaces the native `<select>` used across the app — its popup renders
 * with OS chrome that can't be themed, breaking out of the paper/dark
 * surfaces everywhere else. Built on Radix Select for listbox behaviour
 * and ARIA wiring (technical decisions §6, same split as Modal); the look
 * is Ced OS's own: trigger matches Input's boxed/tinted variants, the
 * popover is a card (solid border, dashed row dividers per
 * design-reference/readme.md — "Dividers"), selection uses the accent.
 */
const TRIGGER_VARIANTS = {
  boxed: "border border-border bg-transparent",
  tinted: "border-none bg-text/5",
} as const;

export type SelectVariant = keyof typeof TRIGGER_VARIANTS;

export function Select({
  value,
  onValueChange,
  placeholder,
  variant = "boxed",
  disabled,
  className,
  "aria-label": ariaLabel,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  variant?: SelectVariant;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-input px-2.75 py-2",
          "font-mono text-[12.5px] text-text outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[placeholder]:text-muted",
          TRIGGER_VARIANTS[variant],
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="shrink-0 text-muted">⌄</RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 max-h-[min(320px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)]",
            "overflow-y-auto rounded-input border border-border bg-card p-1 shadow-dialog",
          )}
        >
          <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export function SelectItem({
  value,
  disabled,
  children,
}: {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <RadixSelect.Item
      value={value}
      disabled={disabled}
      className={cn(
        "row-divider flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-2.5 py-2",
        "font-mono text-[12.5px] text-text outline-none",
        "first:border-t-0",
        "data-[highlighted]:bg-accent/12 data-[highlighted]:text-accent",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        "data-[state=checked]:text-accent",
      )}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}
