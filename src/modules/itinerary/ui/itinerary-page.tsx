"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import Link from "next/link";
import { useState } from "react";

import { ISO_DATE } from "@/core/date";
import { userMessage } from "@/core/errors";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { EmptyState, PageHeader } from "@/core/ui/page-header";

import type { TripView } from "../schema";

type TripStatus = "upcoming" | "now" | "past";

/** Derived purely from dates already on the trip — no schema field needed. */
function tripStatus(trip: TripView, today: string): TripStatus {
  if (today < trip.startDate) return "upcoming";
  if (today > trip.endDate) return "past";
  return "now";
}

const STATUS_LABEL: Record<TripStatus, string> = {
  upcoming: "upcoming",
  now: "happening now",
  past: "past",
};

const STATUS_BADGE: Record<TripStatus, string> = {
  upcoming: "border-accent-blue/35 text-accent-blue",
  now: "border-accent-green/35 text-accent-green",
  past: "border-border text-muted",
};

/** "SEP 12-15, 2026" same month, "DEC 27-JAN 2, 2027" across months — only the end year shows. */
export function formatTripRange(startIso: string, endIso: string): string {
  const start = DateTime.fromFormat(startIso, ISO_DATE, { zone: "utc" });
  const end = DateTime.fromFormat(endIso, ISO_DATE, { zone: "utc" });
  const sameMonth = start.month === end.month && start.year === end.year;
  const startPart = start.toFormat("LLL d");
  const endPart = sameMonth ? end.toFormat("d") : end.toFormat("LLL d");
  return `${startPart}-${endPart}, ${end.toFormat("yyyy")}`.toUpperCase();
}

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

  // Upcoming and current trips lead; past trips trail, dimmed but not hidden.
  const sorted = [...trips].sort((a, b) => {
    const rank = (t: TripView) => (tripStatus(t, today) === "past" ? 1 : 0);
    return rank(a) - rank(b) || a.startDate.localeCompare(b.startDate);
  });

  return (
    <>
      <PageHeader
        kicker="Track"
        title="Itinerary"
        actions={<Button onClick={() => setCreating(true)}>+ new trip</Button>}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-260 p-8">
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
            <div className="flex flex-wrap gap-3.5">
              {sorted.map((trip) => {
                const status = tripStatus(trip, today);
                return (
                  <Card
                    key={trip.id}
                    className={cn(
                      "w-full p-0 sm:w-70",
                      status === "now" && "border-accent-green",
                      status === "past" && "opacity-70",
                    )}
                  >
                    <Link
                      href={`/itinerary/${trip.id}`}
                      className="block px-4 py-3.5"
                      aria-label={`Open ${trip.placeName}`}
                    >
                      <div className="kicker">
                        {formatTripRange(trip.startDate, trip.endDate)}
                      </div>
                      <h2 className="m-0 mt-1 font-serif text-[20px] font-normal tracking-[-0.012em]">
                        {trip.placeName}
                      </h2>
                      <p className="m-0 mt-0.5 font-mono text-[11.5px] text-muted">
                        {trip.dayCount} {trip.dayCount === 1 ? "day" : "days"} ·{" "}
                        {/* A trip with no stops is a valid state, not a broken one
                            (product spec §10). */}
                        {trip.stopCount === 0
                          ? "not planned yet"
                          : `${trip.stopCount} ${trip.stopCount === 1 ? "stop" : "stops"}`}
                      </p>
                      <span
                        className={cn(
                          "mt-2 inline-block rounded-pill border px-2 py-0.75 font-mono text-[10px] uppercase tracking-[0.12em]",
                          STATUS_BADGE[status],
                        )}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {creating && <TripModal trip={null} today={today} onClose={() => setCreating(false)} />}
    </>
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
      titleVisible={false}
      width={420}
    >
      <div className="mt-2.5 flex flex-col gap-4">
        <Input
          variant="ghost"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          placeholder="Where to?"
          aria-label="Destination"
          className="placeholder:italic"
          autoFocus
        />

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
