import { z } from "zod";

import { ACCENTS, DENSITIES, THEMES } from "@/core/theme/types";

/**
 * One schema shared by the route handler and the form — the reason Zod is
 * "locked without debate" in the stack table.
 */

export const appearanceSchema = z.object({
  theme: z.enum(THEMES),
  accent: z.enum(ACCENTS),
  density: z.enum(DENSITIES),
});

export type AppearanceInput = z.infer<typeof appearanceSchema>;

export const preferencesSchema = z.object({
  /**
   * ISO weekday: 1 = Monday, 7 = Sunday. Introduced by decision A5 — an
   * N-times-per-week habit cannot compute its weekly window without it.
   */
  weekStartsOn: z.union([z.literal(1), z.literal(7)]),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
