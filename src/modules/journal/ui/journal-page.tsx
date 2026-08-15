"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { formatEntryDay, formatEntryMonth } from "@/core/date";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/ui/cn";
import { EmptyState, PageHeader } from "@/core/ui/page-header";
import type { EntryView } from "../schema";

import { JournalEntry } from "./journal-entry";

export function JournalPage({
  initial,
  todayIso,
}: {
  initial: EntryView[];
  todayIso: string;
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: entries = initial } = useQuery({
    queryKey: ["journal"],
    queryFn: () => api.get<EntryView[]>("/api/journal"),
    initialData: initial,
  });

  // Falls back to the most recent entry whenever nothing has been explicitly
  // selected yet, same pattern as Notes.
  const effectiveId = selectedId ?? entries[0]?.id ?? null;
  const selected = entries.find((entry) => entry.id === effectiveId) ?? null;

  const create = useMutation({
    mutationFn: async () => {
      const id = newId();
      await api.post("/api/journal", { id, entryDate: todayIso, body: "" });
      return id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ["journal"] });
      setSelectedId(id);
    },
  });

  return (
    <>
      <PageHeader
        kicker={`Journal · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        title="Journal"
        actions={
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            + new entry
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "w-full flex-col border-border lg:w-70 lg:flex-none lg:border-r",
            selectedId ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex-1 overflow-auto p-4 lg:p-5">
            {entries.length === 0 ? (
              <EmptyState line="no entries yet" />
            ) : (
              <div className="flex flex-col gap-1">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    className={cn(
                      "w-full rounded-card px-3 py-3 text-left",
                      entry.id === effectiveId
                        ? "bg-card shadow-[inset_0_0_0_1px_var(--border)]"
                        : "bg-transparent",
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[22px] leading-none">
                        {formatEntryDay(entry.entryDate)}
                      </span>
                      <span className="font-mono text-[10.5px] tracking-widest text-muted">
                        {formatEntryMonth(entry.entryDate)}
                      </span>
                    </div>
                    <p className="m-0 mt-1.5 line-clamp-3 font-serif text-[13.5px] leading-normal text-muted">
                      {entry.body.trim().slice(0, 90) || "Nothing written down yet"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn("min-w-0 flex-1", selectedId ? "block" : "hidden lg:block")}>
          {selected ? (
            <JournalEntry
              key={selected.id}
              entry={selected}
              onDeleted={() => setSelectedId(null)}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="p-4 sm:p-8">
              <EmptyState
                line="no entries yet"
                action={
                  <Button
                    variant="dashed"
                    className="w-full"
                    onClick={() => create.mutate()}
                    disabled={create.isPending}
                  >
                    + write your first entry
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
