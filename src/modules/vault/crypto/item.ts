import { z } from "zod";

import type { Bytes } from "./key";

/**
 * Item sealing (system design §4.1, decision C).
 *
 * AES-GCM covers the entire record — site, username, password, url,
 * category, notes — so the server learns nothing beyond "this user has N
 * items". That is also why category lives inside the sealed blob rather than
 * as a column: a queryable category would leak exactly the information this
 * design exists to hide, and spec §11 explicitly anticipates a recovery code
 * ending up in the notes field, which is what "the whole record is sensitive"
 * is defending against.
 */

export const VAULT_CATEGORIES = [
  "SOCIAL",
  "FINANCE",
  "WORK",
  "SHOPPING",
  "ENTERTAINMENT",
  "OTHER",
] as const;

export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export const VAULT_CATEGORY_LABELS: Record<VaultCategory, string> = {
  SOCIAL: "Social",
  FINANCE: "Finance",
  WORK: "Work",
  SHOPPING: "Shopping",
  ENTERTAINMENT: "Entertainment",
  OTHER: "Other",
};

/** Fixed per category, not user-chosen — unlike Calendar/Habits colour tags. */
export const VAULT_CATEGORY_COLORS: Record<VaultCategory, string> = {
  SOCIAL: "blue",
  FINANCE: "green",
  WORK: "violet",
  SHOPPING: "terracotta",
  ENTERTAINMENT: "sky",
  OTHER: "warmgray",
};

const vaultItemPlainSchema = z.object({
  site: z.string().trim().min(1),
  username: z.string(),
  password: z.string(),
  url: z.string().nullable(),
  category: z.enum(VAULT_CATEGORIES),
  notes: z.string().nullable(),
});

export type VaultItemPlain = z.infer<typeof vaultItemPlainSchema>;

const AES_GCM = "AES-GCM";
const IV_BYTES = 12;

export async function sealItem(
  plain: VaultItemPlain,
  dek: CryptoKey,
): Promise<{ ciphertext: Bytes; iv: Bytes }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const bytes = new TextEncoder().encode(JSON.stringify(plain));
  const ciphertext = await crypto.subtle.encrypt({ name: AES_GCM, iv }, dek, bytes);
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

export async function openItem(
  ciphertext: Bytes,
  iv: Bytes,
  dek: CryptoKey,
): Promise<VaultItemPlain> {
  const bytes = await crypto.subtle.decrypt({ name: AES_GCM, iv }, dek, ciphertext);
  const json: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return vaultItemPlainSchema.parse(json);
}
