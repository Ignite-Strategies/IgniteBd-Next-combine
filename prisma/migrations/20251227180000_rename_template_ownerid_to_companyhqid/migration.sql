-- Migration: Rename Template.ownerId to Template.companyHQId
-- This makes the field name match what it actually references (company_hqs.id)

-- Step 1: Drop the old foreign key constraint
ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "templates_ownerId_fkey";

-- Step 2: Drop the old index
DROP INDEX IF EXISTS "templates_ownerId_idx";

-- Step 3: Rename the column
ALTER TABLE "templates" RENAME COLUMN "ownerId" TO "companyHQId";

-- Step 4: Recreate the foreign key constraint with new name
ALTER TABLE "templates" ADD CONSTRAINT "templates_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Create new index with correct name
CREATE INDEX "templates_companyHQId_idx" ON "templates"("companyHQId");

