import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/core/auth/supabase-server";
import { safeNext } from "@/core/auth/safe-redirect";

/**
 * Lands here after a Supabase email link (signup confirmation, password
 * recovery) redirects back from `/auth/v1/verify`. That endpoint appends a
 * PKCE `code`, which must be exchanged for a session before the cookie
 * exists — without this route the link has nowhere valid to land.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Either there was no code (e.g. Supabase's own /verify step already
  // rejected the link and appended #error=... instead) or the exchange
  // failed (expired/already-used code). Surface that on sign-in instead of
  // a bare, unexplained redirect.
  return NextResponse.redirect(`${origin}/sign-in?error=confirmation_failed`);
}
