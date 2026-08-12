import { readRoute, route } from "@/core/mutation/handler";
import { deleteItemSchema, upsertItemSchema } from "@/modules/vault/schema";
import { listItems, softDeleteItem, upsertItem } from "@/modules/vault/service";

/** Blobs in, blobs out — see service.ts. Nothing here can see a password. */
export const GET = readRoute(async ({ session }) => {
  return listItems(session.userId);
});

export const POST = route(upsertItemSchema, async ({ session, body }) => {
  await upsertItem(session.userId, body);
});

/** Same shape as POST — an edit reseals the whole record, so create and update are one upsert. */
export const PATCH = route(upsertItemSchema, async ({ session, body }) => {
  await upsertItem(session.userId, body);
});

export const DELETE = route(deleteItemSchema, async ({ session, body }) => {
  await softDeleteItem(session.userId, body.id);
});
