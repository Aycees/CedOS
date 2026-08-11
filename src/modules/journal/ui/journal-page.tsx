"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { formatListDate } from "@/core/date";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input, Textarea } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { EmptyState } from "@/core/ui/page-header";
import type { EntryView } from "../schema";

const JOURNAL_KEY = ["journal"];

export function JournalPage({
  initial,
  todayIso,
}: {
  initial: EntryView[];
  todayIso: string;
}) {
  const [editing, setEditing] = useState<EntryView | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: entries = initial } = useQuery({
    queryKey: JOURNAL_KEY,
    queryFn: () => api.get<EntryView[]>("/api/journal"),
    initialData: initial,
  });

  return (
    <div className="max-w-[760px] p-8">
      <div className="mb-5">
        <Button onClick={() => setCreating(true)}>+ new entry</Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          line="no entries yet"
          action={
            <Button variant="dashed" onClick={() => setCreating(true)}>
              + write today&rsquo;s entry
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <button
                type="button"
                onClick={() => setEditing(entry)}
                className="w-full text-left"
              >
                <div className="kicker">{formatListDate(entry.entryDate)}</div>
                {/* Long entries preview rather than render in full (spec §7). */}
                <p className="m-0 mt-2 line-clamp-4 whitespace-pre-wrap font-serif text-[16.5px] leading-[1.65]">
                  {entry.body.trim() || "Nothing written down yet"}
                </p>
              </button>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <EntryModal
          entry={editing}
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

function EntryModal({
  entry,
  todayIso,
  onClose,
}: {
  entry: EntryView | null;
  todayIso: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? todayIso);
  const [body, setBody] = useState(entry?.body ?? "");
  const [sameDay, setSameDay] = useState<EntryView[]>([]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
    onClose();
  };

  /*
   * A4: multiple entries per date are allowed. So this looks for existing
   * entries on the chosen date and offers a hint — it never blocks the save.
   */
  useEffect(() => {
    const params = new URLSearchParams({ onDate: entryDate });
    if (entry?.id) params.set("exclude", entry.id);
    let cancelled = false;

    void api
      .get<EntryView[]>(`/api/journal?${params}`)
      .then((found) => {
        if (!cancelled) setSameDay(found);
      })
      .catch(() => setSameDay([]));

    return () => {
      cancelled = true;
    };
  }, [entryDate, entry?.id]);

  const save = useMutation({
    mutationFn: () =>
      entry
        ? api.patch("/api/journal", { id: entry.id, entryDate, body })
        : api.post("/api/journal", { id: newId(), entryDate, body }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/journal?id=${entry!.id}`),
    onSuccess: invalidate,
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={entry ? "EDIT ENTRY" : "NEW ENTRY"}
      title={entry ? "Edit entry" : "Write today's entry"}
      width={520}
    >
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Date</span>
          <Input
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </label>

        {sameDay.length > 0 && (
          <p className="m-0 font-mono text-[11.5px] text-muted">
            you already wrote on this date — {sameDay.length}{" "}
            {sameDay.length === 1 ? "entry" : "entries"} already here
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Entry</span>
          {/* Plain prose, no markdown structure — that boundary with Notes
              is deliberate (product spec §7). */}
          <Textarea
            rows={12}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="How was today?"
            className="font-serif text-[16.5px] leading-[1.65]"
          />
        </label>
      </div>

      <ModalActions
        destructive={
          entry ? (
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
