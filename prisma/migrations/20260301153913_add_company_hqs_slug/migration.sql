-- Add slug column to company_hqs for cockpit routes
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Create unique index on slug (allows NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "company_hqs_slug_key" ON "company_hqs"("slug") WHERE "slug" IS NOT NULL;

-- Create regular index for lookups
CREATE INDEX IF NOT EXISTS "company_hqs_slug_idx" ON "company_hqs"("slug");

-- Backfill existing companies: generate slug from companyName
-- Slug format: lowercase, replace non-alphanumeric with hyphens, trim hyphens
UPDATE "company_hqs"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE("companyName", '[^a-zA-Z0-9]+', '-', 'g'),
    '^-|-$', '', 'g'
  )
)
WHERE "slug" IS NULL;

-- Ensure no empty slugs
UPDATE "company_hqs"
SET "slug" = 'company-' || SUBSTRING("id", 1, 8)
WHERE "slug" IS NULL OR TRIM("slug") = '';
