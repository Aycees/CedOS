import { z } from "zod";

/**
 * Product spec §12.1. Only `name` is required — Profile must render cleanly
 * with everything else blank.
 *
 * Note there is no `age` field: age is derived from birthday at render time
 * so it cannot go stale.
 */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "A name keeps the sidebar sane.").max(120).optional(),
  pronouns: z.string().trim().max(60).nullable().optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 1998-04-23.")
    .nullable()
    .optional(),
  location: z.string().trim().max(160).nullable().optional(),
  contactEmail: z.email("That doesn't look like an email.").nullable().optional(),
  /** IANA zone. Required in the DB — "today" everywhere depends on it. */
  timezone: z.string().trim().min(1).max(64).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export type ProfileView = {
  name: string;
  pronouns: string | null;
  birthday: string | null;
  location: string | null;
  contactEmail: string | null;
  timezone: string;
  bio: string | null;
};
