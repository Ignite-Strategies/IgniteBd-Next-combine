-- ContentSnip hydration model: snipId, snipSlug (unique), personaSlug, bestUsedWhen; remove company/assemblyHelperPersonas/isActive

-- 1. Rename primary key column
ALTER TABLE "content_snips" RENAME COLUMN "id" TO "snipId";

-- 2. Add new columns (nullable initially for backfill)
ALTER TABLE "content_snips" ADD COLUMN IF NOT EXISTS "snipSlug" TEXT;
ALTER TABLE "content_snips" ADD COLUMN IF NOT EXISTS "personaSlug" TEXT;
ALTER TABLE "content_snips" ADD COLUMN IF NOT EXISTS "bestUsedWhen" TEXT;

-- 3. Backfill snipSlug: slug from snipName + first 8 chars of snipId for uniqueness
UPDATE "content_snips" SET "snipSlug" = lower(regexp_replace(regexp_replace(trim("snipName"), E'\\s+', '_', 'g'), '[^a-z0-9_-]', '', 'g')) || '-' || left("snipId", 8)
WHERE "snipSlug" IS NULL;

-- 4. Migrate first assemblyHelperPersonas element to personaSlug (optional)
UPDATE "content_snips" SET "personaSlug" = "assemblyHelperPersonas"[1]
WHERE array_length("assemblyHelperPersonas", 1) > 0 AND "personaSlug" IS NULL;

-- 5. Drop FK and company-scoped constraints/indexes
ALTER TABLE "content_snips" DROP CONSTRAINT IF EXISTS "content_snips_companyHQId_fkey";
DROP INDEX IF EXISTS "content_snips_companyHQId_snipName_key";
DROP INDEX IF EXISTS "content_snips_companyHQId_idx";
DROP INDEX IF EXISTS "content_snips_companyHQId_templatePosition_idx";
DROP INDEX IF EXISTS "content_snips_companyHQId_isActive_idx";

-- 6. Drop old columns
ALTER TABLE "content_snips" DROP COLUMN IF EXISTS "companyHQId";
ALTER TABLE "content_snips" DROP COLUMN IF EXISTS "assemblyHelperPersonas";
ALTER TABLE "content_snips" DROP COLUMN IF EXISTS "isActive";

-- 7. Enforce snipSlug NOT NULL and unique (backfill already done)
UPDATE "content_snips" SET "snipSlug" = "snipId" WHERE "snipSlug" IS NULL OR "snipSlug" = '';
ALTER TABLE "content_snips" ALTER COLUMN "snipSlug" SET NOT NULL;
CREATE UNIQUE INDEX "content_snips_snipSlug_key" ON "content_snips"("snipSlug");
CREATE INDEX "content_snips_templatePosition_idx" ON "content_snips"("templatePosition");
