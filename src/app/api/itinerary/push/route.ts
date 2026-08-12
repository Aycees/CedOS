import { route } from "@/core/mutation/handler";
import { pushSchema } from "@/modules/itinerary/schema";
import { ensureTravelCategory, pushTrip } from "@/modules/itinerary/service";

/**
 * Two-step by design (system design §5.2): `preview` returns the plan so the
 * user can be told "this will update 6 events and create 2" before anything
 * is written, and `apply` commits it in one transaction.
 */
export const POST = route(pushSchema, ({ session, body }) =>
  pushTrip(session.userId, body.tripId, body.mode),
);

/** Creates the Travel calendar when the push is blocked for want of one. */
export const PATCH = route(pushSchema.pick({ tripId: true }), async ({ session }) => {
  await ensureTravelCategory(session.userId);
});
