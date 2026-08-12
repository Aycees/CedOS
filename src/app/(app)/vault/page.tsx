"use client";

import { VaultRoot } from "@/modules/vault/ui/vault-root";

/**
 * The route root is itself a client component (system design §4.4) — there
 * is no server-fetched prop to pass down, on purpose. Everything the Vault
 * needs, it fetches and decrypts itself, beneath the ESLint boundary on
 * modules/vault/ui/**.
 */
export default function Vault() {
  return <VaultRoot />;
}
