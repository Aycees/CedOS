import "server-only";

import { prisma } from "@/core/db/client";
import { owned } from "@/core/db/scope";
import type { Accent, Density, Theme } from "@/core/theme/types";

import type { AppearanceInput, PreferencesInput } from "./schema";

/**
 * The only place in this module that touches Prisma (decision log §7).
 *
 * UserSettings has no `deletedAt` — it is a singleton provisioned with the
 * account — so queries use `owned` rather than `live`.
 */

export async function updateAppearance(userId: string, input: AppearanceInput) {
  await prisma.userSettings.update({
    where: { userId },
    data: {
      theme: input.theme === "dark" ? "DARK" : "PAPER",
      accentColor: input.accent,
      density: input.density === "compact" ? "COMPACT" : "COMFORTABLE",
    },
  });
}

export async function updatePreferences(userId: string, input: PreferencesInput) {
  await prisma.userSettings.update({
    where: { userId },
    data: { weekStartsOn: input.weekStartsOn },
  });
}

export type SettingsView = {
  theme: Theme;
  accent: Accent;
  density: Density;
  weekStartsOn: number;
  currency: string;
};

export async function getSettings(userId: string): Promise<SettingsView> {
  const settings = await prisma.userSettings.findFirstOrThrow({
    where: owned(userId),
  });

  return {
    theme: settings.theme === "DARK" ? "dark" : "paper",
    accent: settings.accentColor as Accent,
    density: settings.density === "COMPACT" ? "compact" : "comfortable",
    weekStartsOn: settings.weekStartsOn,
    currency: settings.currency,
  };
}
