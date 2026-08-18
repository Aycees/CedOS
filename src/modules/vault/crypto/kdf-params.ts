/**
 * Argon2id cost parameters, and the bounds a stored set has to satisfy.
 *
 * Deliberately dependency-free and separate from `key.ts`: the wire schema in
 * `../schema.ts` validates these, and `schema.ts` is imported by route
 * handlers. Pulling in `key.ts` there would drag hash-wasm into the server
 * bundle for a constant.
 *
 * These are not fixed forever — they are VaultSettings columns precisely so
 * they can be raised later without a migration, and an existing vault keeps
 * unlocking with whatever it was written under. Raising `KDF_BOUNDS.*.min`
 * therefore only constrains new writes; it never invalidates a stored vault.
 */

export type KdfParams = {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
};

/** Matches the VaultSettings column defaults. Every honest client writes exactly this. */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  memoryKiB: 65536,
  iterations: 3,
  parallelism: 1,
};

/**
 * What the server will accept into `vault_settings`.
 *
 * The floor is the real point. Nothing in the app ever writes anything but
 * `DEFAULT_KDF_PARAMS`, so anything weaker arriving at the API is either a
 * tampered client or someone driving the endpoint with a stolen session —
 * and a rewrap at m=1KiB, t=1 re-wraps the DEK under a KEK that falls to
 * offline brute force from a database dump, silently, with the vault still
 * behaving normally. The floor is set at the current defaults because there
 * is no legitimate caller that needs to go below them.
 *
 * The ceiling guards the opposite failure: a stored value of, say, 2^31 KiB
 * makes every future unlock try to allocate terabytes, and the vault becomes
 * permanently unopenable with no in-app way back.
 */
export const KDF_BOUNDS = {
  memoryKiB: { min: DEFAULT_KDF_PARAMS.memoryKiB, max: 1_048_576 },
  iterations: { min: DEFAULT_KDF_PARAMS.iterations, max: 10 },
  parallelism: { min: 1, max: 4 },
} as const;
