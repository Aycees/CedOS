"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { Segmented } from "@/core/ui/segmented";
import type { NoteView } from "../schema";

import { Markdown } from "./markdown";

/**
 * Each toolbar action, expressed as a transform over the current selection.
 *
 * Wrapping rather than replacing is what makes the toolbar useful on existing
 * text: selecting a word and pressing bold should embolden that word, not
 * overwrite it.
 */
type Action = {
  label: string;
  title: string;
  apply: (selected: string) => { text: string; caret: number };
  /** Line-level actions operate on whole lines rather than the raw selection. */
  perLine?: boolean;
};

const ACTIONS: Action[] = [
  {
    label: "B",
    title: "Bold",
    apply: (s) => ({ text: `**${s}**`, caret: s ? 0 : 2 }),
  },
  {
    label: "i",
    title: "Italic",
    apply: (s) => ({ text: `*${s}*`, caret: s ? 0 : 1 }),
  },
  {
    label: "H",
    title: "Heading",
    perLine: true,
    apply: (s) => ({ text: `## ${s}`, caret: 0 }),
  },
  {
    label: "☐",
    title: "Checklist",
    perLine: true,
    apply: (s) => ({ text: `- [ ] ${s}`, caret: 0 }),
  },
  {
    label: "❝",
    title: "Quote",
    perLine: true,
    apply: (s) => ({ text: `> ${s}`, caret: 0 }),
  },
  {
    label: "<>",
    title: "Code",
    apply: (s) => ({ text: `\`${s}\``, caret: s ? 0 : 1 }),
  },
  {
    label: "—",
    title: "Divider",
    perLine: true,
    apply: () => ({ text: "---", caret: 0 }),
  },
];

export function NoteEditor({
  note,
  todayIso,
  onClose,
}: {
  note: NoteView | null;
  todayIso: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(note?.title ?? "");
  const [tag, setTag] = useState(note?.tag ?? "");
  const [noteDate, setNoteDate] = useState(note?.noteDate ?? todayIso);
  const [body, setBody] = useState(note?.body ?? "");
  const [mode, setMode] = useState<"markdown" | "preview">("markdown");

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { title, tag: tag || null, noteDate, body };
      return note
        ? api.patch("/api/notes", { id: note.id, ...payload })
        : api.post("/api/notes", { id: newId(), ...payload });
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/notes?id=${note!.id}`),
    onSuccess: done,
  });

  const runAction = (action: Action) => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);

    let replacement: string;
    if (action.perLine) {
      const lines = (selected || "").split("\n");
      replacement = lines.map((line) => action.apply(line).text).join("\n");
    } else {
      replacement = action.apply(selected).text;
    }

    const next = body.slice(0, start) + replacement + body.slice(end);
    setBody(next);

    // Put the caret where the user can keep typing: inside the markers when
    // nothing was selected, after the inserted text when something was.
    const caretOffset = selected
      ? replacement.length
      : action.apply("").caret || replacement.length;

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + caretOffset, start + caretOffset);
    });
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={note ? "EDIT NOTE" : "NEW NOTE"}
      title={note ? "Edit note" : "New note"}
      width={720}
    >
      <div className="mt-5 flex flex-col gap-4">
        <Input
          variant="ghost"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          aria-label="Note title"
        />

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Tag</span>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="school, personal…"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Date</span>
            <Input
              type="date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Segmented
            aria-label="Editor mode"
            value={mode}
            onChange={setMode}
            options={[
              { label: "Markdown", value: "markdown" },
              { label: "Preview", value: "preview" },
            ]}
          />

          {mode === "markdown" && (
            <div className="ml-auto flex items-center gap-1">
              {ACTIONS.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  title={action.title}
                  aria-label={action.title}
                  onClick={() => runAction(action)}
                  className="grid size-7 place-items-center rounded-[6px] border border-border font-mono text-[11.5px] text-muted"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/*
          Switching to preview and back never touches the stored text: the
          markdown is the single representation, and preview is a render of
          it. That is what makes the round-trip in product spec §6 lossless
          by construction rather than by careful conversion.
        */}
        {mode === "markdown" ? (
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            aria-label="Note body"
            placeholder="# Heading&#10;&#10;- [ ] a checklist item&#10;&#10;> a quote"
            className="w-full resize-y rounded-input border border-border bg-transparent px-[11px] py-2 font-mono text-[12.5px] leading-relaxed text-text outline-none placeholder:text-muted"
          />
        ) : (
          <div className="min-h-[320px] rounded-input border border-border px-[14px] py-3">
            {body.trim() ? (
              <Markdown>{body}</Markdown>
            ) : (
              <p className="m-0 font-serif text-[15px] italic text-muted">
                nothing written down yet
              </p>
            )}
          </div>
        )}
      </div>

      <ModalActions
        destructive={
          note ? (
            <Button variant="outline" onClick={() => remove.mutate()}>
              delete
            </Button>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}
