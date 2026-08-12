"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { formatListDate } from "@/core/date";
import { userMessage } from "@/core/errors";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { EmptyState } from "@/core/ui/page-header";

import type { TripView } from "../schema";

export function ItineraryPage({
  initial,
  today,
}: {
  initial: TripView[];
  today: string;
}) {
  const [creating, setCreating] = useState(false);

  const { data: trips = initial } = useQuery({
    queryKey: ["itinerary", "trips"],
    queryFn: () => api.get<TripView[]>("/api/itinerary/trips"),
    initialData: initial,
  });

  return (
    <div className="max-w-[760px] p-8">
      <Button className="mb-5" onClick={() => setCreating(true)}>
        + new trip
      </Button>

      {trips.length === 0 ? (
        <EmptyState
          line="no trips yet"
          action={
            <Button variant="dashed" className="w-full" onClick={() => setCreating(true)}>
              + plan a trip
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {trips.map((trip) => (
            <Card key={trip.id} className="p-0">
              <Link
                href={`/itinerary/${trip.id}`}
                className="block px-[22px] py-5"
                aria-label={`Open ${trip.placeName}`}
              >
                <div className="kicker">
                  {formatListDate(trip.startDate)} – {formatListDate(trip.endDate)} ·{" "}
                  {trip.dayCount} {trip.dayCount === 1 ? "day" : "days"}
                </div>
                <h2 className="m-0 mt-1.5 font-serif text-[24px] font-normal tracking-[-0.012em]">
                  {trip.placeName}
                </h2>
                <p className="m-0 mt-1 font-mono text-[11.5px] text-muted">
                  {/* A trip with no stops is a valid state, not a broken one
                      (product spec §10). */}
                  {trip.stopCount === 0
                    ? "not planned yet"
                    : `${trip.stopCount} ${trip.stopCount === 1 ? "stop" : "stops"}`}
                </p>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {creating && <TripModal trip={null} today={today} onClose={() => setCreating(false)} />}
    </div>
  );
}

export function TripModal({
  trip,
  today,
  onClose,
  onDeleted,
}: {
  trip: TripView | null;
  today: string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [placeName, setPlaceName] = useState(trip?.placeName ?? "");
  const [startDate, setStartDate] = useState(trip?.startDate ?? today);
  const [endDate, setEndDate] = useState(trip?.endDate ?? today);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["itinerary"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: () =>
      trip
        ? api.patch("/api/itinerary/trips", { id: trip.id, placeName, startDate, endDate })
        : api.post("/api/itinerary/trips", {
            id: newId(),
            placeName,
            startDate,
            endDate,
          }),
    onSuccess: done,
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  const remove = useMutation({
    mutationFn: () => api.delete("/api/itinerary/trips", { id: trip!.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["itinerary"] });
      onDeleted?.();
      onClose();
    },
  });

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={trip ? "EDIT TRIP" : "NEW TRIP"}
      title={trip ? "Edit trip" : "New trip"}
      width={420}
    >
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Place</span>
          <Input
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="Baguio, Siargao…"
            autoFocus
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">Start</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="kicker">End</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        {trip && (
          <p className="m-0 font-mono text-[11px] leading-relaxed text-muted">
            {/* A8: stops keep their own dates, so shortening a trip surfaces
                the strays rather than deleting them. */}
            shortening a trip keeps any stops that fall outside the new dates —
            they move to their own list rather than being deleted
          </p>
        )}

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
      </div>

      <ModalActions
        destructive={
          trip ? (
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
          disabled={!placeName.trim() || save.isPending}
        >
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}
