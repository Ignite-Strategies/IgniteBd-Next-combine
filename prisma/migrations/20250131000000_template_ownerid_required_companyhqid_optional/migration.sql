-- Migration: Template ownerId required, companyHQId optional
-- Add ownerId column and backfill from companyHQId
-- Make companyHQId optional

-- Step 1: Add ownerId column if it doesn't exist
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- Step 2: Drop any old constraints/indexes on ownerId if they exist (in case of partial migration)
ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "templates_ownerId_fkey";
DROP INDEX IF EXISTS "templates_ownerId_idx";

-- Step 3: Backfill ownerId from companyHQId -> company_hqs.ownerId
UPDATE "templates" t
SET "ownerId" = ch."ownerId"
FROM "company_hqs" ch
WHERE t."companyHQId" = ch."id"
  AND t."ownerId" IS NULL
  AND ch."ownerId" IS NOT NULL;

-- Step 6: Make ownerId NOT NULL
-- Note: This will fail if there are still NULL values after backfill
-- In that case, you need to manually backfill or delete templates without owners
ALTER TABLE "templates" ALTER COLUMN "ownerId" SET NOT NULL;

-- Step 7: Add foreign key constraint for ownerId -> owners.id (if it doesn't exist)
-- Drop existing constraint if it points to wrong table, then recreate
ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "templates_ownerId_fkey";
ALTER TABLE "templates" ADD CONSTRAINT "templates_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Create index on ownerId
CREATE INDEX IF NOT EXISTS "templates_ownerId_idx" ON "templates"("ownerId");

-- Step 9: Make companyHQId nullable (drop NOT NULL constraint)
ALTER TABLE "templates" ALTER COLUMN "companyHQId" DROP NOT NULL;

