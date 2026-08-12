import { DateTime } from "luxon";

import { requireSession } from "@/core/auth/session";
import { todayIso } from "@/core/date";
import { PageHeader } from "@/core/ui/page-header";
import { getOverview, listCategories } from "@/modules/finance/service";
import { FinancePage } from "@/modules/finance/ui/finance-page";

export default async function Finance() {
  const session = await requireSession();
  const today = todayIso(session.timezone);
  const month = DateTime.now().setZone(session.timezone).toFormat("yyyy-MM");

  const [overview, categories] = await Promise.all([
    getOverview(session.userId, month),
    listCategories(session.userId),
  ]);

  return (
    <>
      <PageHeader kicker={`Finance · ${overview.monthLabel}`} title="Money" />
      <div className="flex-1 overflow-auto">
        <FinancePage
          overview={overview}
          categories={categories}
          month={month}
          today={today}
        />
      </div>
    </>
  );
}
