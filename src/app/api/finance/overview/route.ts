import { todayIso } from "@/core/date";
import { readRoute } from "@/core/mutation/handler";
import { getOverview } from "@/modules/finance/service";

export const GET = readRoute(({ session, searchParams }) =>
  getOverview(
    session.userId,
    searchParams.get("month") ?? todayIso(session.timezone).slice(0, 7),
  ),
);
