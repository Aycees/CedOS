import type { HTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * The default surface for any grouped content.
 *
 * Flat by design: solid 1px border, 12px radius, card background, and
 * **never a shadow** — modals are the only shadowed surface in this system
 * (design-reference/components/core/Card.prompt.md).
 */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-card border border-border bg-card px-[22px] py-5",
        className,
      )}
      {...rest}
    />
  );
}
