"use client";

import { useEffect, useRef, useState } from "react";

import { lock } from "./session";

/**
 * Idle timer (system design §4.5, decision A9). Activity is mouse, keyboard,
 * scroll and click, and only counts while this hook is mounted — i.e. only
 * while the Vault route is on screen. Warns at T−30s, then locks: zeroes the
 * DEK and clears the decrypted list via `lock()`. Any open draft is
 * discarded by construction — nothing here persists it, and A9 decided
 * against an "unsaved changes" prompt.
 */

const WARNING_LEAD_SECONDS = 30;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "click"] as const;

export function useAutoLock(autoLockSeconds: number, enabled: boolean) {
  const [warning, setWarning] = useState(false);
  const lastActivity = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    lastActivity.current = Date.now();

    const bump = () => {
      lastActivity.current = Date.now();
      setWarning(false);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, bump, { passive: true });
    }

    const interval = window.setInterval(() => {
      const idleSeconds = (Date.now() - lastActivity.current) / 1000;
      if (idleSeconds >= autoLockSeconds) {
        lock();
        setWarning(false);
      } else if (idleSeconds >= autoLockSeconds - WARNING_LEAD_SECONDS) {
        setWarning(true);
      }
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, bump);
      }
      window.clearInterval(interval);
    };
  }, [autoLockSeconds, enabled]);

  return {
    warning,
    stillHere: () => {
      lastActivity.current = Date.now();
      setWarning(false);
    },
  };
}
