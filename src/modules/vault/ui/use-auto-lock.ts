"use client";

import { useEffect, useState } from "react";

import { getAutoLockSeconds, idleSeconds, noteActivity } from "./session";

/**
 * The warning banner's clock (system design §4.5, decision A9).
 *
 * Locking itself is NOT done here — `session.ts` owns the idle watchdog, so
 * it keeps running when the user navigates away from the Vault route and the
 * key is zeroed on schedule regardless of what is on screen. This hook only
 * decides when to show the "still there?" banner, which is a question about
 * the visible UI and therefore genuinely belongs to a mounted component.
 *
 * Any open draft is discarded when the lock fires, by construction — nothing
 * here persists it, and A9 decided against an "unsaved changes" prompt.
 */

const WARNING_LEAD_SECONDS = 30;

export function useAutoLock() {
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWarning(idleSeconds() >= getAutoLockSeconds() - WARNING_LEAD_SECONDS);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return {
    warning,
    stillHere: () => {
      noteActivity();
      setWarning(false);
    },
  };
}
