import clsx, { type ClassValue } from "clsx";

/**
 * Class joiner. Intentionally not tailwind-merge: this design system has a
 * small, hand-authored token vocabulary rather than a sprawl of competing
 * utilities, so conflict resolution has nothing to resolve.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
