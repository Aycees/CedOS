import { route } from "@/core/mutation/handler";
import { preferencesSchema } from "@/modules/settings/schema";
import { updatePreferences } from "@/modules/settings/service";

export const PATCH = route(preferencesSchema, async ({ session, body }) => {
  await updatePreferences(session.userId, body);
});
