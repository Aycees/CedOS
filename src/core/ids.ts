import { uuidv7 } from "uuidv7";

/**
 * The only id generator in the application.
 *
 * Non-negotiable #1: ids are UUIDv7, generated client-side, never by the
 * database. Two reasons, both from technical decisions §1:
 *
 *   · Optimistic UI needs the id before the round-trip completes.
 *   · It is the worst migration on the deferred-offline list if skipped —
 *     retrofitting client ids against years of real rows is brutal, while
 *     adopting them now costs nothing.
 *
 * v7 rather than v4 because the timestamp prefix keeps ids roughly ordered,
 * which keeps B-tree index inserts local instead of scattering them.
 *
 * `crypto.randomUUID()` is banned by lint rule. It produces v4, which throws
 * both properties away.
 */
export function newId(): string {
  return uuidv7();
}
