"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { formatListDate } from "@/core/date";
import { api } from "@/core/mutation/client";
import { cn } from "@/core/ui/cn";
import type { NoteView } from "../schema";

import { wordCount } from "./markdown";

const AUTOSAVE_DELAY_MS = 700;
const DELETE_ARM_MS = 3000;

/** Cmd/Ctrl+B and Cmd/Ctrl+I wrap the selection — Markdown has no underline
 * syntax, so there is no third shortcut here. */
const SHORTCUTS: Record<string, (selected: string) => { text: string; caret: number }> = {
  b: (s) => ({ text: `**${s}**`, caret: s ? 0 : 2 }),
  i: (s) => ({ text: `*${s}*`, caret: s ? 0 : 1 }),
};

export function NoteEditor({
  note,
  onDeleted,
  onBack,
}: {
  note: NoteView;
  onDeleted: () => void;
  /** Renders a mobile-only "back to list" affordance when supplied — the
   * modal-embedded quick-note editor (home's QuickActions) has no list to
   * return to, so it omits this. */
  onBack?: () => void;
}) {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The parent mounts this component with `key={note.id}`, so switching notes
  // remounts it fresh — these initializers only ever see the newly-selected
  // note, never stomping on typing from a background refetch of the same one.
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!note.title && !note.body) titleRef.current?.focus();
  }, [note.title, note.body]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, []);

  const save = useMutation({
    mutationFn: (payload: { title: string; body: string }) =>
      api.patch("/api/notes", { id: note.id, ...payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/notes?id=${note.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      onDeleted();
    },
  });

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      save.mutate({ title: nextTitle, body: nextBody });
    }, AUTOSAVE_DELAY_MS);
  };

  const flush = () => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    save.mutate({ title, body });
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleSave(value, body);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    scheduleSave(title, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const apply = SHORTCUTS[e.key.toLowerCase()];
    if (!apply) return;
    e.preventDefault();

    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    const { text, caret } = apply(selected);
    const next = body.slice(0, start) + text + body.slice(end);

    handleBodyChange(next);

    const caretOffset = selected ? text.length : caret;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + caretOffset, start + caretOffset);
    });
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
            aria-label="Back to notes"
            onClick={onBack}
            className="grid size-7 flex-none place-items-center rounded-md border border-border text-muted lg:hidden"
          >
            <BackGlyph />
          </button>
        )}

        <span className="min-w-0 truncate kicker">
          edited {formatListDate(note.noteDate)} · {words} {words === 1 ? "word" : "words"}
        </span>

        <button
          type="button"
          aria-label={armed ? "Click again to delete this note" : "Delete note"}
          title={armed ? "Click again to delete" : "Delete note"}
          onClick={handleDeleteClick}
          className={cn(
            "ml-auto grid size-7 flex-none place-items-center rounded-md",
            armed ? "text-accent-red" : "text-muted",
          )}
        >
          <TrashGlyph />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={flush}
          placeholder="Untitled"
          aria-label="Note title"
          className="mb-3.5 w-full flex-none border-none bg-transparent font-serif text-[29px] font-medium tracking-[-0.01em] text-text outline-none placeholder:text-muted"
        />

        <div className="flex-1 overflow-auto">
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onBlur={flush}
            onKeyDown={handleKeyDown}
            aria-label="Note body"
            placeholder="Start writing…"
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
