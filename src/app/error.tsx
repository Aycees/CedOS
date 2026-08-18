"use client";

import { useEffect } from "react";

import { Button } from "@/core/ui/button";

/**
 * Catches render and data errors anywhere under `app/` — the (app) shell and
 * sign-in both. Without this file an unhandled error falls through to Next's
 * unstyled default, which has no way back into the app short of a reload.
 *
 * `reset()` re-renders the failed segment, which is usually enough when the
 * cause was a transient fetch; the link out is there for when it isn't.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled render error", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="flex max-w-105 flex-col items-start gap-4">
        <span className="kicker">Something broke</span>
        <p className="m-0 font-serif text-[16.5px] italic leading-[1.65] text-muted">
          that didn&rsquo;t load. the error has been logged — trying again is
          usually enough.
        </p>
        {/* The digest is the only handle on a production error, where the
            message itself is stripped before it reaches the browser. */}
        {error.digest && (
          <span className="font-mono text-[11px] text-muted">
            ref {error.digest}
          </span>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={reset}>try again</Button>
          {/* A full document load, not router.push(): this boundary is
              rendering because something under it already threw, so the
              client router's state is exactly what should not be trusted to
              carry the user out. eslint-disable rather than a soft nav. */}
          <Button
            variant="outline"
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            onClick={() => window.location.assign("/")}
          >
            back to today
          </Button>
        </div>
      </div>
    </div>
  );
}
