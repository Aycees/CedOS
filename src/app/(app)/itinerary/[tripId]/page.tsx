import { notFound } from "next/navigation";

import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { getTrip } from "@/modules/itinerary/service";
import { TripDetail } from "@/modules/itinerary/ui/trip-detail";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await requireSession();
  const { tripId } = await params;

  // getTrip throws NOT_FOUND for a missing or someone else's trip; catching
  // only the lookup keeps the render itself outside the try, so a render
  // error is not swallowed into a 404.
  const trip = await getTrip(session.userId, tripId).catch(() => null);
  if (!trip) notFound();

  return <TripDetail initial={trip} today={todayIso(session.timezone)} />;
}
