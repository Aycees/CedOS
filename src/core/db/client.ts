import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * The only file in the application that constructs a PrismaClient.
 *
 * `server-only` makes an accidental import from a client component a build
 * error rather than a runtime surprise — which matters most for the Vault,
 * where the client-only boundary is a security property (system design §4.4).
 *
 * Note that Prisma connects as a privileged role and BYPASSES row-level
 * security. RLS is deny-all on every table purely as a backstop; the real
 * boundary is core/db/scope.ts, which requires an explicit userId on every
 * query (decision log §5).
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Next's dev server re-evaluates modules on every edit; without this the
// connection pool grows until Postgres refuses new connections.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
