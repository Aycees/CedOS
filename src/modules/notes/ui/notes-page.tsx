"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { formatShortDate } from "@/core/date";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { EmptyState, PageHeader } from "@/core/ui/page-header";
import { Segmented } from "@/core/ui/segmented";
import { displayTitle, type NoteView } from "../schema";

import { markdownPreview } from "./markdown";
import { NoteEditor } from "./note-editor";

export function NotesPage({
  initial,
  todayIso,
}: {
  initial: NoteView[];
  todayIso: string;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list" | "grid">("grid");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const search = new URLSearchParams();
  if (query.trim()) search.set("q", query.trim());

  const { data: notes = initial } = useQuery({
    queryKey: ["notes", query.trim()],
    queryFn: () => api.get<NoteView[]>(`/api/notes?${search}`),
    initialData: !query.trim() ? initial : undefined,
    placeholderData: (previous) => previous,
  });

  // Falls back to the first note whenever nothing has been explicitly
  // selected yet, without needing an effect — a search refetch never steals
  // focus away from a note the user already opened, since selectedId sticks
  // once a click sets it.
  const effectiveId = selectedId ?? notes[0]?.id ?? null;
  const selected = notes.find((note) => note.id === effectiveId) ?? null;

  const create = useMutation({
    mutationFn: async () => {
      const id = newId();
      await api.post("/api/notes", { id, title: "", body: "", noteDate: todayIso });
      return id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(id);
    },
  });

  return (
    <>
      <PageHeader
        kicker={`Notes · ${notes.length} ${notes.length === 1 ? "item" : "items"}`}
        title="Notes"
        actions={
          <>
            <Segmented
              aria-label="Notes view"
              value={view}
              onChange={setView}
              options={[
                { label: "List", value: "list" },
                { label: "Grid", value: "grid" },
              ]}
            />
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              + new note
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "w-full flex-col border-border lg:w-85 lg:flex-none lg:border-r",
            selectedId ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex h-18 items-center border-b border-border px-4 lg:px-5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
            />
          </div>

          <div className="flex-1 overflow-auto">
            {notes.length === 0 ? (
              <div className="p-4">
                <EmptyState line={query.trim() ? "no notes match" : "no notes yet"} />
              </div>
            ) : view === "list" ? (
              notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedId(note.id)}
                  className={cn(
                    "row-divider list-row flex w-full items-baseline gap-3 px-4 text-left",
                    note.id === effectiveId &&
                      "bg-[color-mix(in_srgb,var(--text)_5%,transparent)]",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                    {displayTitle(note)}
                  </span>
                  <span className="flex-none font-mono text-[10.5px] tracking-widest text-muted">
                    {formatShortDate(note.noteDate)}
                  </span>
                </button>
              ))
            ) : (
              <div className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-2 lg:grid-cols-1">
                {notes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelectedId(note.id)}
                    className="text-left"
                  >
                    <Card
                      style={{ backgroundColor: "var(--sidebar)" }}
                      className={cn(
                        "h-28 overflow-hidden px-4 py-3",
                        note.id === effectiveId && "border-border-strong",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="m-0 min-w-0 truncate font-serif text-[16px] font-semibold">
                          {displayTitle(note)}
                        </h2>
                        <span className="flex-none font-mono text-[10.5px] tracking-widest text-muted">
                          {formatShortDate(note.noteDate)}
                        </span>
                      </div>
                      {/* Preview, never a full render — a fixed card height
                          means a long note must not grow the card. */}
                      <p className="m-0 mt-1.5 line-clamp-2 font-mono text-[11.5px] leading-relaxed text-muted">
                        {markdownPreview(note.body)}
                      </p>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn("min-w-0 flex-1", selectedId ? "block" : "hidden lg:block")}>
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              onDeleted={() => setSelectedId(null)}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="p-4 sm:p-8">
              <EmptyState
                line="no notes yet"
                action={
                  <Button variant="dashed" className="w-full" onClick={() => create.mutate()}>
                    + write your first note
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
