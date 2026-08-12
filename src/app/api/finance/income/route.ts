import { readRoute, route } from "@/core/mutation/handler";
import { upsertIncomeSchema } from "@/modules/finance/schema";
import { getIncome, upsertIncome } from "@/modules/finance/service";

export const GET = readRoute(({ session }) => getIncome(session.userId));

export const POST = route(upsertIncomeSchema, async ({ session, body }) => {
  await upsertIncome(session.userId, body);
});
