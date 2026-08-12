"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase Auth adapter — browser half. Sign-in, sign-up and sign-out only.
 *
 * This client is never used to read application data: every table is RLS
 * deny-all, and all data access goes through route handlers scoped by
 * core/db/scope.ts.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
