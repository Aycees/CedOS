import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { PageHeader } from "@/core/ui/page-header";
import { listTrips } from "@/modules/itinerary/service";
import { ItineraryPage } from "@/modules/itinerary/ui/itinerary-page";

export default async function Itinerary() {
  const session = await requireSession();
  const trips = await listTrips(session.userId);

  return (
    <>
      <PageHeader kicker="Track" title="Itinerary" />
      <div className="flex-1 overflow-auto">
        <ItineraryPage initial={trips} today={todayIso(session.timezone)} />
      </div>
    </>
  );
}
