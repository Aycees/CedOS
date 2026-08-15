import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { listTrips } from "@/modules/itinerary/service";
import { ItineraryPage } from "@/modules/itinerary/ui/itinerary-page";

export default async function Itinerary() {
  const session = await requireSession();
  const trips = await listTrips(session.userId);

  return <ItineraryPage initial={trips} today={todayIso(session.timezone)} />;
}
