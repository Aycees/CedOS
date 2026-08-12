"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/core/ui/button";
import type { CategoryView } from "@/modules/calendar/schema";
import { EventModal } from "@/modules/calendar/ui/event-modal";
import { NoteEditor } from "@/modules/notes/ui/note-editor";

/**
 * Reuses EventModal and NoteEditor directly rather than reimplementing them
 * (product spec §11's warning against shortcuts applies here in spirit too —
 * two create flows for the same data would drift). `router.refresh()` on
 * close re-fetches Home's server-rendered cards; harmless on cancel, and
 * what makes a new event show up in Today's schedule immediately on save.
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

  const close = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" onClick={() => setModal("note")}>
        + quick note
      </Button>
      <Button onClick={() => setModal("event")}>+ event</Button>

      {modal === "note" && <NoteEditor note={null} todayIso={todayIso} onClose={close} />}
      {modal === "event" && (
        <EventModal event={null} defaultDate={todayIso} categories={categories} onClose={close} />
      )}
    </>
  );
}
