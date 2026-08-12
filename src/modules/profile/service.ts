import "server-only";

import { dbDateToIso, isoToDbDate } from "@/core/date";
import { prisma } from "@/core/db/client";
import { owned } from "@/core/db/scope";

import type { ProfileView, UpdateProfileInput } from "./schema";

/** The only place in this module that touches Prisma (decision log §7). */

export async function getProfile(userId: string): Promise<ProfileView> {
  const profile = await prisma.profile.findFirstOrThrow({ where: owned(userId) });

  return {
    name: profile.name,
    pronouns: profile.pronouns,
    birthday: profile.birthday ? dbDateToIso(profile.birthday) : null,
    location: profile.location,
    contactEmail: profile.contactEmail,
    timezone: profile.timezone,
    bio: profile.bio,
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  await prisma.profile.update({
    where: { userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.pronouns !== undefined ? { pronouns: emptyToNull(input.pronouns) } : {}),
      ...(input.birthday !== undefined
        ? { birthday: input.birthday ? isoToDbDate(input.birthday) : null }
        : {}),
      ...(input.location !== undefined ? { location: emptyToNull(input.location) } : {}),
      ...(input.contactEmail !== undefined
        ? { contactEmail: emptyToNull(input.contactEmail) }
        : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.bio !== undefined ? { bio: emptyToNull(input.bio) } : {}),
    },
  });
}

/** An emptied optional field means "unset", not "the empty string". */
function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
