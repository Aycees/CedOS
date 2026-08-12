import { readRoute, route } from "@/core/mutation/handler";
import { updateProfileSchema } from "@/modules/profile/schema";
import { getProfile, updateProfile } from "@/modules/profile/service";

export const GET = readRoute(({ session }) => getProfile(session.userId));

export const PATCH = route(updateProfileSchema, async ({ session, body }) => {
  await updateProfile(session.userId, body);
});
