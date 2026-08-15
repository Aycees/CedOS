"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatListDate, formatSidebarDate, ISO_DATE } from "@/core/date";
import { userMessage } from "@/core/errors";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { Input, Textarea } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { PageHeader } from "@/core/ui/page-header";

import type { PushPreview, StopView, TripDetailView } from "../schema";
import { formatTripRange, TripModal } from "./itinerary-page";

const TIMES = Array.from({ length: 24 * 4 }, (_, i) => {
  const hours = String(Math.floor(i / 4)).padStart(2, "0");
  const minutes = String((i % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});

export function TripDetail({
  initial,
  today,
}: {
  initial: TripDetailView;
  today: string;
}) {
  const router = useRouter();
  const [editingTrip, setEditingTrip] = useState(false);
  const [stopModal, setStopModal] = useState<{ stop: StopView | null; date: string } | null>(
    null,
  );
  const [push, setPush] = useState<PushPreview | null>(null);

  const { data: trip = initial } = useQuery({
    queryKey: ["itinerary", "trip", initial.id],
    queryFn: () =>
      api.get<TripDetailView>(`/api/itinerary/trips?tripId=${initial.id}`),
    initialData: initial,
  });

  const preview = useMutation({
    mutationFn: () =>
      api.post<PushPreview>("/api/itinerary/push", {
        tripId: trip.id,
        mode: "preview",
      }),
    onSuccess: setPush,
  });

  return (
    <>
      <PageHeader
        kicker={`${formatTripRange(trip.startDate, trip.endDate)} · ${trip.dayCount} ${trip.dayCount === 1 ? "day" : "days"}`}
        title={trip.placeName}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingTrip(true)}>
              edit trip
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => preview.mutate()}
              disabled={preview.isPending}
            >
              push to calendar
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-205 p-8">
          <Button
            variant="outline"
            size="sm"
            className="mb-6"
            onClick={() => router.push("/itinerary")}
          >
            ← all trips
          </Button>

          {trip.outside.length > 0 && (
            <Card className="mb-4.5 border-accent-red">
              <div className="kicker mb-1">Outside trip dates</div>
              <p className="m-0 mb-2 font-mono text-[11.5px] text-muted">
                {/* A8: shortening a trip surfaces the strays for a decision
                    rather than deleting them. */}
                these stops fall outside {formatListDate(trip.startDate)} –{" "}
                {formatListDate(trip.endDate)}. move or remove them.
              </p>
              {trip.outside.map((stop) => (
                <StopRow
                  key={stop.id}
                  stop={stop}
                  onEdit={() => setStopModal({ stop, date: stop.stopDate })}
                />
              ))}
            </Card>
          )}

          <div className="flex flex-col gap-4.5">
            {trip.days.map((day) => (
              <Card key={day.date}>
                <div className="flex items-baseline gap-2.5 border-b border-dashed border-border pb-2.5">
                  <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.04em] text-text">
                    Day {day.dayIndex}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                    {formatSidebarDate(DateTime.fromFormat(day.date, ISO_DATE, { zone: "utc" }))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStopModal({ stop: null, date: day.date })}
                    className="ml-auto font-mono text-[11.5px] text-accent"
                  >
                    + add stop
                  </button>
                </div>

                {day.stops.length === 0 ? (
                  <p className="m-0 py-8 text-center font-serif text-[15px] italic text-muted">
                    nothing planned
                  </p>
                ) : (
                  day.stops.map((stop, i) => (
                    <StopRow
                      key={stop.id}
                      stop={stop}
                      divider={i > 0}
                      onEdit={() => setStopModal({ stop, date: day.date })}
                    />
                  ))
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {editingTrip && (
        <TripModal
          trip={trip}
          today={today}
          onClose={() => setEditingTrip(false)}
          onDeleted={() => router.push("/itinerary")}
        />
      )}

      {stopModal && (
        <StopModal
          stop={stopModal.stop}
          tripId={trip.id}
          date={stopModal.date}
          onClose={() => setStopModal(null)}
        />
      )}

      {push && (
        <PushDialog preview={push} tripId={trip.id} onClose={() => setPush(null)} />
      )}
    </>
  );
}

function StopRow({
  stop,
  onEdit,
  divider = true,
}: {
  stop: StopView;
  onEdit: () => void;
  divider?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${stop.activity}`}
      className={cn(
        "list-row flex w-full items-baseline gap-3 text-left",
        divider && "row-divider",
      )}
    >
      <span className="w-14 flex-none font-mono text-[12px] text-muted">
        {/* An untimed stop reads as unscheduled rather than as midnight. */}
        {stop.startTime ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[13px]">{stop.activity}</span>
        {stop.note && (
          <span className="block font-mono text-[10.5px] text-muted">{stop.note}</span>
        )}
      </span>
      {stop.location && (
        <span className="flex-none font-mono text-[10.5px] text-muted">
          {stop.location}
        </span>
      )}
      {stop.pushedEventId && (
        <span className="flex-none font-mono text-[10px] text-muted" title="on your calendar">
          ✓
        </span>
      )}
    </button>
  );
}

function StopModal({
  stop,
  tripId,
  date,
  onClose,
}: {
  stop: StopView | null;
  tripId: string;
  date: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [stopDate, setStopDate] = useState(stop?.stopDate ?? date);
  const [startTime, setStartTime] = useState(stop?.startTime ?? "");
  const [activity, setActivity] = useState(stop?.activity ?? "");
  const [location, setLocation] = useState(stop?.location ?? "");
  const [note, setNote] = useState(stop?.note ?? "");

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["itinerary"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        stopDate,
        startTime: startTime || null,
        activity,
        location: location || null,
        note: note || null,
      };
      return stop
        ? api.patch("/api/itinerary/stops", { id: stop.id, ...payload })
        : api.post("/api/itinerary/stops", { id: newId(), tripId, ...payload });
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: () => api.delete("/api/itinerary/stops", { id: stop!.id }),
    onSuccess: done,
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={stop ? "EDIT STOP" : "NEW STOP"}
      title={activity || (stop ? "Edit stop" : "New stop")}
      width={460}
    >
      <div className="mt-5 flex flex-col gap-4">
        <Input
          variant="ghost"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="What's the plan?"
          aria-label="Activity"
          autoFocus
        />

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Date</span>
            <Input
              type="date"
              value={stopDate}
              onChange={(e) => setStopDate(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Time</span>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-input border border-border bg-transparent px-2.75 py-2 font-mono text-[12.5px] text-text outline-none"
            >
              {/* Untimed is a real choice — "decide the night before". */}
              <option value="">no set time</option>
              {TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
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
      </div>

      <ModalActions
        destructive={
          stop ? (
            <Button variant="outline" onClick={() => remove.mutate()}>
              delete
            </Button>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!activity.trim()}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}

/**
 * The push preview (system design §5.2).
 *
 * The plan is computed before anything is written, so the user is told
 * exactly what will happen — "this will update 6 events and create 2" —
 * reusing the same shape as the A1 impact dialog.
 */
function PushDialog({
  preview,
  tripId,
  onClose,
}: {
  preview: PushPreview;
  tripId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const createCategory = useMutation({
    mutationFn: () => api.patch("/api/itinerary/push", { tripId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onClose();
    },
  });

  const apply = useMutation({
    mutationFn: () =>
      api.post<PushPreview>("/api/itinerary/push", { tripId, mode: "apply" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["itinerary"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setDone(true);
    },
    onError: (e) => setError(userMessage(e, "The push failed.")),
  });

  const nothingToDo =
    preview.create === 0 && preview.update === 0 && preview.orphan === 0;

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker="PUSH TO CALENDAR"
      title={done ? "Added to your Travel calendar" : "Push to calendar"}
      width={440}
    >
      <div className="mt-4 flex flex-col gap-3">
        {preview.blocked === "NO_TRAVEL_CATEGORY" ? (
          <>
            <p className="m-0 font-mono text-[12.5px] leading-relaxed text-muted">
              {/* Consistent with product spec §4: no event may be
                  uncategorised, so the push waits for a calendar to exist. */}
              you don&rsquo;t have a Travel calendar yet, and every event needs one.
            </p>
            <Button onClick={() => createCategory.mutate()}>
              create a Travel calendar
            </Button>
          </>
        ) : done ? (
          <p className="m-0 font-mono text-[12.5px] text-muted">
            {preview.create} created · {preview.update} updated
          </p>
        ) : nothingToDo ? (
          <p className="m-0 font-mono text-[12.5px] text-muted">
            everything is already in sync — nothing to change
          </p>
        ) : (
          <ul className="m-0 list-none p-0 font-mono text-[12.5px] text-muted">
            <li className="list-row">{preview.create} events will be created</li>
            <li className="row-divider list-row">{preview.update} will be updated</li>
            {preview.unchanged > 0 && (
              <li className="row-divider list-row">
                {preview.unchanged} already match
              </li>
            )}
            {preview.orphan > 0 && (
              <li className="row-divider list-row text-accent-red">
                {preview.orphan} pushed{" "}
                {preview.orphan === 1 ? "event no longer has" : "events no longer have"} a
                stop — they stay on your calendar
              </li>
            )}
          </ul>
        )}

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
      </div>

      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          {done ? "close" : "cancel"}
        </Button>
        {!done && !preview.blocked && (
          <Button onClick={() => apply.mutate()} disabled={nothingToDo || apply.isPending}>
            push
          </Button>
        )}
      </ModalActions>
    </Modal>
  );
}
