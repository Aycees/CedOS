"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { AppError } from "@/core/errors";
import { Button } from "@/core/ui/button";
import { Input, Textarea } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import type { CategoryView, EventView } from "../schema";

/** Five-minute steps, matching the time picker in the mockup. */
const TIMES = Array.from({ length: 24 * 12 }, (_, i) => {
  const hours = String(Math.floor(i / 12)).padStart(2, "0");
  const minutes = String((i % 12) * 5).padStart(2, "0");
  return `${hours}:${minutes}`;
});

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
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
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
    onError: (e) => setError(e instanceof AppError ? e.message : "That didn't save."),
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
    >
      <div className="mt-5 flex flex-col gap-4">
        <Input
          variant="ghost"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          aria-label="Event title"
          autoFocus
        />

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Date</span>
            <Input
              type="date"
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
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-input border border-border bg-transparent px-[11px] py-2 font-mono text-[12.5px] text-text outline-none"
            >
              <option value="">all day</option>
              {TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="kicker">Calendar</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-input border border-border bg-transparent px-[11px] py-2 font-mono text-[12.5px] text-text outline-none"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

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
            <Button variant="outline" onClick={() => remove.mutate()}>
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
