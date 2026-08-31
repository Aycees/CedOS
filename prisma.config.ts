import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 no longer reads `.env` implicitly, so the import above is what
 * makes env vars reach the CLI. It also replaces the `prisma` block in
 * package.json, which Prisma 7 removed.
 *
 * The CLI (migrate, generate, studio) connects via DIRECT_URL, not
 * DATABASE_URL: Prisma 7 dropped schema-level `directUrl`, and the migration
 * engine doesn't work through a transaction-mode pooler (Supabase's Supavisor
 * on :6543) - it needs a direct or session-mode (:5432) connection. The app's
 * runtime client is unaffected; it reads DATABASE_URL itself in
 * core/db/client.ts via the pg driver adapter, independent of this file.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
