"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { userMessage } from "@/core/errors";
import { Button } from "@/core/ui/button";
import { Input, Textarea } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { TimePicker } from "@/core/ui/time-picker";
import type { CategoryView, EventView } from "../schema";

export function EventModal({
  event,
  defaultDate,
  categories,
  onClose,
}: {
  event: EventView | null;
  defaultDate: string;
  categories: CategoryView[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setEventDate] = useState(event?.eventDate ?? defaultDate);
  // A new event defaults to a timed 9am slot; an existing event keeps
  // whatever it actually has, including all-day (null startTime).
  const [startTime, setStartTime] = useState(event ? (event.startTime ?? "") : "09:00");
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? categories[0]?.id ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [note, setNote] = useState(event?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        eventDate,
        startTime: startTime || null,
        categoryId,
        location: location || null,
        note: note || null,
      };
      return event
        ? api.patch("/api/calendar/events", { id: event.id, ...payload })
        : api.post("/api/calendar/events", { id: newId(), ...payload });
    },
    onSuccess: done,
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/calendar/events?id=${event!.id}`),
    onSuccess: done,
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={event ? "EDIT EVENT" : "NEW EVENT"}
      title={event ? "Edit event" : "New event"}
      width={460}
      titleVisible={false}
    >
      <div className="flex flex-col gap-4">
        <Input
          variant="ghost"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={event ? "Edit event" : "Event title"}
          aria-label="Event title"
          autoFocus
          className="mt-3"
        />

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Date</span>
            <Input
              type="date"
              tinted
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>

          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Time · optional</span>
            {/*
              Empty means untimed, which is a real state rather than midnight —
              the whole reason startTime is a nullable time column (A2).
            */}
            <TimePicker value={startTime} onChange={setStartTime} />
          </label>
        </div>

        <label className="flex items-center gap-3 font-mono text-[12px] text-text">
          <input
            type="checkbox"
            checked={!startTime}
            onChange={(e) => setStartTime(e.target.checked ? "" : "09:00")}
            className="m-0 size-3.75 shrink-0 accent-accent"
          />
          <span>all-day</span>
        </label>

        <div className="flex flex-col gap-2">
          <span className="kicker">Calendar</span>
          <div className="flex flex-wrap gap-1.75">
            {categories.map((category) => {
              const selected = categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(category.id)}
                  className="flex items-center gap-1.75 rounded-pill border px-3.25 py-1.5 font-mono text-[11.5px] text-text"
                  style={{
                    borderColor: selected ? `var(--accent-${category.color})` : "var(--border)",
                    background: selected
                      ? `color-mix(in srgb, var(--accent-${category.color}) 10%, transparent)`
                      : "transparent",
                  }}
                >
                  <span
                    aria-hidden
                    className="size-2 flex-none rounded-full"
                    style={{ background: `var(--accent-${category.color})` }}
                  />
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Location · optional</span>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Note</span>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything to remember"
          />
        </label>

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}

        {event?.fromItinerary && (
          <p className="m-0 font-mono text-[11px] text-muted">
            pushed from an itinerary — re-pushing that trip will update this event
          </p>
        )}
      </div>

      <ModalActions
        destructive={
          event ? (
            <Button
              variant="outline"
              className="border-accent-terracotta/40 text-accent-terracotta"
              onClick={() => remove.mutate()}
            >
              delete
            </Button>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !title.trim() || !categoryId}
        >
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}
