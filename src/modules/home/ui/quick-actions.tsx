"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Modal } from "@/core/ui/modal";
import type { CategoryView } from "@/modules/calendar/schema";
import { EventModal } from "@/modules/calendar/ui/event-modal";
import type { NoteView } from "@/modules/notes/schema";
import { NoteEditor } from "@/modules/notes/ui/note-editor";

/**
 * Reuses EventModal and NoteEditor directly rather than reimplementing them
 * (product spec §11's warning against shortcuts applies here in spirit too —
 * two create flows for the same data would drift). `router.refresh()` on
 * close re-fetches Home's server-rendered cards; harmless on cancel, and
 * what makes a new event show up in Today's schedule immediately on save.
 *
 * NoteEditor is an always-editing inline panel now (it autosaves and has no
 * "new" mode), so a quick note is created up front and NoteEditor is dropped
 * into a Modal shell — the same component the full Notes page embeds inline.
 */
export function QuickActions({
  categories,
  todayIso,
}: {
  categories: CategoryView[];
  todayIso: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"note" | "event" | null>(null);
  const [note, setNote] = useState<NoteView | null>(null);

  const close = () => {
    setModal(null);
    setNote(null);
    router.refresh();
  };

  const createNote = useMutation({
    mutationFn: async () => {
      const view: NoteView = { id: newId(), title: "", tag: null, noteDate: todayIso, body: "" };
      await api.post("/api/notes", view);
      return view;
    },
    onSuccess: (view) => {
      setNote(view);
      setModal("note");
    },
  });

  return (
    <>
      <Button
        variant="outline"
        onClick={() => createNote.mutate()}
        disabled={createNote.isPending}
      >
        + quick note
      </Button>
      <Button onClick={() => setModal("event")}>+ event</Button>

      {modal === "note" && note && (
        <Modal
          open
          onOpenChange={(open) => !open && close()}
          title="Quick note"
          titleVisible={false}
          width={640}
        >
          <div className="-mx-6.5 -my-6 h-[70vh]">
            <NoteEditor note={note} onDeleted={close} />
          </div>
        </Modal>
      )}
      {modal === "event" && (
        <EventModal event={null} defaultDate={todayIso} categories={categories} onClose={close} />
      )}
    </>
  );
}
