import { readRoute, route } from "@/core/mutation/handler";
import {
  createEventSchema,
  deleteEventSchema,
  updateEventSchema,
} from "@/modules/calendar/schema";
import {
  createEvent,
  deleteEvent,
  listEventsInMonth,
  listEventsOnDate,
  updateEvent,
} from "@/modules/calendar/service";

export const GET = readRoute(async ({ session, searchParams }) => {
  const date = searchParams.get("date");
  if (date) return listEventsOnDate(session.userId, date);

  const month = searchParams.get("month");
  return listEventsInMonth(
    session.userId,
    month ?? new Date().toISOString().slice(0, 7),
    session.timezone,
  );
});

export const POST = route(createEventSchema, async ({ session, body }) => {
  await createEvent(session.userId, body);
});

export const PATCH = route(updateEventSchema, async ({ session, body }) => {
  await updateEvent(session.userId, body);
});

export const DELETE = route(deleteEventSchema, async ({ session, body }) => {
  await deleteEvent(session.userId, body.id);
});
