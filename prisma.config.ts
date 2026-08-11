import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 no longer reads `.env` implicitly, so the import above is what
 * makes `DATABASE_URL` reach the CLI. It also replaces the `prisma` block in
 * package.json, which Prisma 7 removed.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
