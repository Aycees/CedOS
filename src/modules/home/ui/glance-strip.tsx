import { formatListDate } from "@/core/date";
import { formatMoney } from "@/core/money";
import { Card } from "@/core/ui/card";

/**
 * At-a-glance strip (product spec §3) — one number per module, each already
 * computed by that module's own summary function (habits' `habitSummary`,
 * finance's `listBudgets`, itinerary's `listTrips`). Empty per card, never
 * one shared blank state.
 */
export function GlanceStrip({
  habitsDue,
  budget,
  nextTrip,
  currency,
}: {
  habitsDue: number;
  budget: { limit: string; spent: string } | null;
  nextTrip: { placeName: string; startDate: string } | null;
  currency: string;
}) {
  return (
    <div className="grid max-w-260 grid-cols-1 gap-5.5 px-8 pb-8 sm:grid-cols-3">
      <Card>
        <div className="kicker mb-1.5">Habits</div>
        {habitsDue > 0 ? (
          <p className="m-0 font-mono text-[13px]">{habitsDue} due today</p>
        ) : (
          <p className="m-0 font-serif text-[15px] italic text-muted">nothing due today</p>
        )}
      </Card>

      <Card>
        <div className="kicker mb-1.5">Budget</div>
        {budget ? (
          <p className="m-0 font-mono text-[13px]">
            {formatMoney(budget.spent, currency)} of {formatMoney(budget.limit, currency)}
          </p>
        ) : (
          <p className="m-0 font-serif text-[15px] italic text-muted">no budgets set</p>
        )}
      </Card>

      <Card>
        <div className="kicker mb-1.5">Next trip</div>
        {nextTrip ? (
          <p className="m-0 font-mono text-[13px]">
            {nextTrip.placeName} · {formatListDate(nextTrip.startDate)}
          </p>
        ) : (
          <p className="m-0 font-serif text-[15px] italic text-muted">no trip planned</p>
        )}
      </Card>
    </div>
  );
}
