-- Restores the notes full-text-search column, dropped by the previous
-- migration's auto-generated drift correction. schema.prisma cannot express
-- a generated tsvector column (see the comment at Note.search_vector /
-- system-design.md §6), so `prisma migrate dev` sees it as an unmodeled
-- column on every diff and wants to drop it. This re-adds the exact
-- definition from the initial migration; no rows existed to lose.
ALTER TABLE "notes"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body",  '')), 'B')
  ) STORED;

CREATE INDEX "notes_search_vector_idx" ON "notes" USING GIN ("search_vector");
