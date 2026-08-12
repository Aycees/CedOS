import { route } from "@/core/mutation/handler";
import { appearanceSchema } from "@/modules/settings/schema";
import { updateAppearance } from "@/modules/settings/service";

export const PATCH = route(appearanceSchema, async ({ session, body }) => {
  await updateAppearance(session.userId, body);
});
