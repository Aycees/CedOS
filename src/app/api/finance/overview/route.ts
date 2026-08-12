import { readRoute } from "@/core/mutation/handler";
import { getOverview } from "@/modules/finance/service";

export const GET = readRoute(({ session, searchParams }) =>
  getOverview(
    session.userId,
    searchParams.get("month") ?? new Date().toISOString().slice(0, 7),
  ),
);
