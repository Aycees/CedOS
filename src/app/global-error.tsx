"use client";

import { useEffect } from "react";

import "@/styles/globals.css";

/**
 * The last resort: a failure in the root layout itself, which `error.tsx`
 * cannot catch because it renders *inside* that layout. This replaces the
 * whole document, so it has to bring its own <html>/<body> — and its own
 * stylesheet, since the layout that normally imports it is the thing that
 * just failed.
 *
 * No token-driven <html> attributes are set here (data-theme et al. come from
 * UserSettings, which is exactly what may be unreachable); the stylesheet's
 * defaults carry the page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] root layout error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="grid min-h-screen place-items-center p-8">
          <div className="flex max-w-105 flex-col items-start gap-4">
            <span className="kicker">Something broke</span>
            <p className="m-0 font-serif text-[16.5px] italic leading-[1.65] text-muted">
              ced os failed to start. the error has been logged.
            </p>
            {error.digest && (
              <span className="font-mono text-[11px] text-muted">
                ref {error.digest}
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              className="rounded-input border border-border-strong px-3 py-2 font-mono text-[11.5px] text-text"
            >
              try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
