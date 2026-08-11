"use client";

import { useEffect } from "react";

import { api } from "@/core/mutation/client";
import { useAppearance } from "@/core/theme/appearance-provider";

/**
 * Persists appearance changes to UserSettings.
 *
 * Deliberately fire-and-forget and debounced: the visual change already
 * happened the instant the attribute was written on <html>, so a slow or
 * failed write must never block or revert the UI. Worst case the choice is
 * not remembered across a reload — a far smaller cost than a theme toggle
 * that stutters.
 */
export function AppearanceSync() {
  const { theme, accent, density } = useAppearance();

  useEffect(() => {
    const timer = setTimeout(() => {
      void api.patch("/api/settings/appearance", { theme, accent, density }).catch(() => {
        /* see above — the visual state is already applied */
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [theme, accent, density]);

  return null;
}
