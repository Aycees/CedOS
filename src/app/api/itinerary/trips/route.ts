import { readRoute, route } from "@/core/mutation/handler";
import type { TripDetailView, TripView } from "@/modules/itinerary/schema";
import {
  createTripSchema,
  deleteTripSchema,
  updateTripSchema,
} from "@/modules/itinerary/schema";
import {
  createTrip,
  deleteTrip,
  getTrip,
  listTrips,
  updateTrip,
} from "@/modules/itinerary/service";

export const GET = readRoute<TripView[] | TripDetailView>(
  ({ session, searchParams }) => {
    const tripId = searchParams.get("tripId");
    if (tripId) return getTrip(session.userId, tripId);
    return listTrips(session.userId);
  },
);

export const POST = route(createTripSchema, async ({ session, body }) => {
  await createTrip(session.userId, body);
});

export const PATCH = route(updateTripSchema, async ({ session, body }) => {
  await updateTrip(session.userId, body);
});

export const DELETE = route(deleteTripSchema, async ({ session, body }) => {
  await deleteTrip(session.userId, body.id);
});
