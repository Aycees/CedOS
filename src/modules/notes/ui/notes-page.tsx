"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { formatListDate } from "@/core/date";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Chip } from "@/core/ui/chip";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { EmptyState } from "@/core/ui/page-header";
import { Segmented } from "@/core/ui/segmented";
import { displayTitle, type NoteView } from "../schema";

import { markdownPreview } from "./markdown";
import { NoteEditor } from "./note-editor";

export function NotesPage({
  initial,
  tags,
  todayIso,
}: {
  initial: NoteView[];
  tags: string[];
  todayIso: string;
}) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<NoteView | null>(null);
  const [creating, setCreating] = useState(false);

  const search = new URLSearchParams();
  if (query.trim()) search.set("q", query.trim());
  if (tag) search.set("tag", tag);

  const { data: notes = initial } = useQuery({
    queryKey: ["notes", query.trim(), tag],
    queryFn: () => api.get<NoteView[]>(`/api/notes?${search}`),
    initialData: !query.trim() && !tag ? initial : undefined,
    placeholderData: (previous) => previous,
  });

  return (
    <div className="p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => setCreating(true)}>+ new note</Button>

        <Input
          className="max-w-[240px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes"
          aria-label="Search notes"
        />

        <Segmented
          className="ml-auto"
          aria-label="Notes view"
          value={view}
          onChange={setView}
          options={[
            { label: "List", value: "list" },
            { label: "Grid", value: "grid" },
          ]}
        />
      </div>

      {tags.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setTag(null)}>
            <Chip className={cn(!tag && "border-border-strong")}>all</Chip>
          </button>
          {tags.map((option) => (
            <button key={option} type="button" onClick={() => setTag(option)}>
              <Chip className={cn(tag === option && "border-border-strong")}>{option}</Chip>
            </button>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          line={query.trim() ? "no notes match" : "no notes yet"}
          action={
            query.trim() ? undefined : (
              <Button variant="dashed" className="w-full" onClick={() => setCreating(true)}>
                + write your first note
              </Button>
            )
          }
        />
      ) : view === "list" ? (
        <div className="max-w-[760px]">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => setEditing(note)}
              className="row-divider list-row flex w-full items-baseline gap-3 text-left"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                {displayTitle(note)}
              </span>
              {note.tag && (
                <span className="flex-none font-mono text-[11px] text-muted">
                  {note.tag}
                </span>
              )}
              <span className="flex-none font-mono text-[10.5px] tracking-[0.1em] text-muted">
                {formatListDate(note.noteDate)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className="p-0">
              <button
                type="button"
                onClick={() => setEditing(note)}
                className="w-full px-[22px] py-5 text-left"
              >
                <div className="kicker">{formatListDate(note.noteDate)}</div>
                <h2 className="m-0 mt-2 font-serif text-[18px] font-normal">
                  {displayTitle(note)}
                </h2>
                {/* Preview, never a full render — a very long note must not
                    try to lay itself out inside a card (product spec §6). */}
                <p className="m-0 mt-2 line-clamp-4 font-mono text-[11.5px] leading-relaxed text-muted">
                  {markdownPreview(note.body)}
                </p>
                {note.tag && (
                  <span className="mt-3 inline-block font-mono text-[10.5px] text-muted">
                    {note.tag}
                  </span>
                )}
              </button>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <NoteEditor
          note={editing}
          todayIso={todayIso}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
