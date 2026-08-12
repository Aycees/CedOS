import "server-only";

import { cache } from "react";

import { prisma } from "@/core/db/client";
import { AppError } from "@/core/errors";
import { newId } from "@/core/ids";

import { createSupabaseServerClient } from "./supabase-server";

export type Session = {
  /** The Supabase auth UID. Also the primary key of our `users` row. */
  userId: string;
  email: string;
  name: string;
  timezone: string;
  weekStartsOn: number;
  currency: string;
  theme: "paper" | "dark";
  accent: string;
  density: "comfortable" | "compact";
};

/**
 * The single source of "who is asking".
 *
 * Wrapped in React's `cache` so a request that renders the shell, a page and
 * several components hits Supabase and Postgres once rather than once per
 * caller.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const record = await ensureUserRecord(user.id, user.email);
  return record;
});

/** For route handlers and pages that cannot proceed without a user. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new AppError("UNAUTHENTICATED", "You need to sign in.");
  }
  return session;
}

/**
 * Mirrors the Supabase auth user into our own tables on first sight, and
 * provisions the two singleton rows every screen assumes exist.
 *
 * `User.id` is the Supabase UID rather than a generated one — it is the join
 * key between the two systems (system design §3.1). Profile and UserSettings
 * ids *are* generated, like every other row.
 *
 * Done in one transaction so a half-provisioned account cannot exist: a user
 * with settings but no profile would render a nameless sidebar.
 */
async function ensureUserRecord(userId: string, email: string): Promise<Session> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, settings: true },
  });

  if (existing?.profile && existing.settings) {
    return toSession(existing.id, existing.email, existing.profile, existing.settings);
  }

  const provisioned = await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: userId },
      update: { email },
      create: { id: userId, email },
    });

    const profile =
      existing?.profile ??
      (await tx.profile.create({
        data: {
          id: newId(),
          userId,
          // Product spec §12.1 treats name as required for a sane identity
          // display; the local-part of the email is the least-surprising seed.
          name: email.split("@")[0] ?? "You",
        },
      }));

    const settings =
      existing?.settings ??
      (await tx.userSettings.create({ data: { id: newId(), userId } }));

    return { profile, settings };
  });

  return toSession(userId, email, provisioned.profile, provisioned.settings);
}

type ProfileRow = { name: string; timezone: string };
type SettingsRow = {
  theme: "PAPER" | "DARK";
  accentColor: string;
  density: "COMFORTABLE" | "COMPACT";
  weekStartsOn: number;
  currency: string;
};

function toSession(
  userId: string,
  email: string,
  profile: ProfileRow,
  settings: SettingsRow,
): Session {
  return {
    userId,
    email,
    name: profile.name,
    timezone: profile.timezone,
    weekStartsOn: settings.weekStartsOn,
    currency: settings.currency,
    theme: settings.theme === "DARK" ? "dark" : "paper",
    accent: settings.accentColor,
    density: settings.density === "COMPACT" ? "compact" : "comfortable",
  };
}
