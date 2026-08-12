/**
 * The three theming axes (product spec §12, technical decisions §6).
 *
 * These unions are declared here rather than imported from the generated
 * Prisma client on purpose: they are consumed by client components, and
 * pulling Prisma types across that boundary is how server code leaks into
 * the browser bundle. `service.ts` maps between these and the DB enums.
 */

export const THEMES = ["paper", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The fixed 4-colour brand set (design-reference/readme.md — "Color"). */
export const ACCENTS = ["blue", "green", "terracotta", "violet"] as const;
export type Accent = (typeof ACCENTS)[number];

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export type Appearance = {
  theme: Theme;
  accent: Accent;
  density: Density;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "paper",
  accent: "terracotta",
  density: "comfortable",
};

/** Human labels for the settings UI. Kept lowercase — the product voice. */
export const ACCENT_LABELS: Record<Accent, string> = {
  blue: "blue",
  green: "green",
  terracotta: "terracotta",
  violet: "violet",
};

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.includes(value as Accent);
}

export function isDensity(value: unknown): value is Density {
  return DENSITIES.includes(value as Density);
}
