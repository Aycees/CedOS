"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker (public/sw.js) once, after first paint. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Offline shell is a progressive enhancement, not a requirement. */
    });
  }, []);

  return null;
}
