"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { formatEntryStamp } from "@/core/date";
import { api } from "@/core/mutation/client";
import { cn } from "@/core/ui/cn";
import { wordCount } from "@/modules/notes/ui/markdown";
import type { EntryView } from "../schema";

const AUTOSAVE_DELAY_MS = 700;
const DELETE_ARM_MS = 3000;

export function JournalEntry({
  entry,
  onDeleted,
  onBack,
}: {
  entry: EntryView;
  onDeleted: () => void;
  /** Renders a mobile-only "back to list" affordance when supplied. */
  onBack?: () => void;
}) {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The parent mounts this component with `key={entry.id}`, so switching
  // entries remounts it fresh.
  const [body, setBody] = useState(entry.body);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, []);

  const save = useMutation({
    mutationFn: (payload: { body: string }) =>
      api.patch("/api/journal", { id: entry.id, ...payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/journal?id=${entry.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal"] });
      onDeleted();
    },
  });

  const scheduleSave = (nextBody: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      save.mutate({ body: nextBody });
    }, AUTOSAVE_DELAY_MS);
  };

  const flush = () => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    save.mutate({ body });
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    scheduleSave(value);
  };

  const handleDeleteClick = () => {
    if (armed) {
      if (armTimer.current) clearTimeout(armTimer.current);
      remove.mutate();
      return;
    }
    setArmed(true);
    armTimer.current = setTimeout(() => setArmed(false), DELETE_ARM_MS);
  };

  const words = wordCount(body);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-18 items-center gap-4 border-b border-border px-4 lg:px-6">
        {onBack && (
          <button
            type="button"
            aria-label="Back to journal"
            onClick={onBack}
            className="grid size-7 flex-none place-items-center rounded-md border border-border text-muted lg:hidden"
          >
            <BackGlyph />
          </button>
        )}

        <span className="flex-none kicker">{formatEntryStamp(entry.entryDate)}</span>

        <div className="h-px min-w-4 flex-1 bg-border" />

        <span className="flex-none kicker">
          {words} {words === 1 ? "word" : "words"}
        </span>

        <button
          type="button"
          aria-label={armed ? "Click again to delete this entry" : "Delete entry"}
          title={armed ? "Click again to delete" : "Delete entry"}
          onClick={handleDeleteClick}
          className={cn(
            "grid size-7 flex-none place-items-center rounded-md",
            armed ? "text-accent-red" : "text-muted",
          )}
        >
          <TrashGlyph />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex-1 overflow-auto">
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onBlur={flush}
            aria-label="Journal entry"
            placeholder="How was today?"
            className="h-full min-h-full w-full resize-none border-none bg-transparent font-serif text-[16.5px] leading-[1.65] text-text outline-none placeholder:italic placeholder:text-muted"
          />
        </div>
      </div>
    </div>
  );
}

/* The system has no icon font and no emoji — a handful of hand-set 24×24
   stroke-line SVGs, stroke-width 2, round caps, currentColor
   (design-reference/guidelines/iconography.html). */
function TrashGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function BackGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
