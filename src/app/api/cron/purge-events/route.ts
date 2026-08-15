import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { purgeOldEvents } from "@/modules/calendar/service";

/**
 * Constant-time compare. `!==` on a secret returns as soon as two bytes
 * differ, which leaks the shared secret prefix-by-prefix to a caller that can
 * time the response — and this is the one route in the app a stranger is
 * allowed to reach. Lengths are compared first because `timingSafeEqual`
 * throws on a mismatch; a length is not the secret.
 */
function secretMatches(presented: string | null, expected: string): boolean {
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

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
  if (!secretMatches(auth, `Bearer ${secret}`)) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Unauthorized." } },
      { status: 401 },
    );
  }

  const result = await purgeOldEvents();
  return NextResponse.json(result);
}
