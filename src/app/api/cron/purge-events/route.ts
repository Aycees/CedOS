import { NextResponse } from "next/server";

import { purgeOldEvents } from "@/modules/calendar/service";

/**
 * Retention cleanup, triggered by an external scheduler (Vercel Cron,
 * Supabase pg_cron, GitHub Actions, ...) rather than a signed-in user, so it
 * authenticates with a shared secret instead of `requireSession`.
 *
 * GET, not POST — most schedulers ping a URL rather than send a body.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/purge-events] CRON_SECRET is not set");
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Cron is not configured." } },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Unauthorized." } },
      { status: 401 },
    );
  }

  const result = await purgeOldEvents();
  return NextResponse.json(result);
}
