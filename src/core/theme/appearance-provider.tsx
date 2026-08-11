"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { APPEARANCE_STORAGE_KEY } from "./appearance-script";
import { DEFAULT_APPEARANCE, type Appearance } from "./types";

type AppearanceContextValue = Appearance & {
  setAppearance: (patch: Partial<Appearance>) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/**
 * Applies the three axes by writing attributes straight onto <html>.
 *
 * Deliberately not React state driving a className: every surface in the app
 * reads CSS custom properties, so mutating the root attribute retheme
 * *everything* in one paint — including portalled modal content that lives
 * outside this provider's React tree. That is what satisfies product spec
 * §12's "no stale-themed surfaces" edge case structurally rather than by
 * remembering to thread a prop through every dialog.
 */
export function AppearanceProvider({
  initial,
  onPersist,
  children,
}: {
  initial: Appearance;
  onPersist?: (appearance: Appearance) => void;
  children: React.ReactNode;
}) {
  const [appearance, setLocal] = useState<Appearance>(initial);

  const setAppearance = useCallback(
    (patch: Partial<Appearance>) => {
      setLocal((current) => {
        const next = { ...current, ...patch };
        const root = document.documentElement;
        root.dataset.theme = next.theme;
        root.dataset.accent = next.accent;
        root.dataset.density = next.density;

        try {
          localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable — the DB remains the source of truth */
        }

        onPersist?.(next);
        return next;
      });
    },
    [onPersist],
  );

  const value = useMemo(
    () => ({ ...appearance, setAppearance }),
    [appearance, setAppearance],
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    return { ...DEFAULT_APPEARANCE, setAppearance: () => {} };
  }
  return context;
}
