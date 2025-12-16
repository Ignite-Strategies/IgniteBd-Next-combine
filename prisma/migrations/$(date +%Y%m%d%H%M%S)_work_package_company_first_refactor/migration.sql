-- Work Package Company-First Refactor Migration
-- Changes:
-- 1. Make companyId required (was optional)
-- 2. Rename contactId to workPackageClientId
-- 3. Add workPackageOwnerId (CompanyHQ.id - IgniteBD owner)
-- 4. Add workPackageMemberId (optional)
-- 5. Add status, metadata, tags fields

-- Step 1: Add new columns (nullable initially for data migration)
ALTER TABLE "work_packages" 
  ADD COLUMN IF NOT EXISTS "workPackageOwnerId" TEXT,
  ADD COLUMN IF NOT EXISTS "workPackageClientId" TEXT,
  ADD COLUMN IF NOT EXISTS "workPackageMemberId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';

-- Step 2: Migrate data - copy contactId to workPackageClientId
UPDATE "work_packages" 
SET "workPackageClientId" = "contactId"
WHERE "workPackageClientId" IS NULL;

-- Step 3: Auto-populate companyId from contact's company where missing
UPDATE "work_packages" wp
SET "companyId" = c."contactCompanyId"
FROM "contacts" c
WHERE wp."workPackageClientId" = c.id
  AND wp."companyId" IS NULL
  AND c."contactCompanyId" IS NOT NULL;

-- Step 4: Auto-populate workPackageOwnerId from company's companyHQId
UPDATE "work_packages" wp
SET "workPackageOwnerId" = comp."companyHQId"
FROM "companies" comp
WHERE wp."companyId" = comp.id
  AND wp."workPackageOwnerId" IS NULL
  AND comp."companyHQId" IS NOT NULL;

-- Step 5: Add foreign key constraints
-- Note: These will fail if there are NULL values, so ensure all data is migrated first

-- Add workPackageOwnerId foreign key to company_hqs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_packages_workPackageOwnerId_fkey'
  ) THEN
    ALTER TABLE "work_packages"
      ADD CONSTRAINT "work_packages_workPackageOwnerId_fkey" 
      FOREIGN KEY ("workPackageOwnerId") 
      REFERENCES "company_hqs"("id") 
      ON DELETE RESTRICT 
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Add workPackageClientId foreign key to contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_packages_workPackageClientId_fkey'
  ) THEN
    ALTER TABLE "work_packages"
      ADD CONSTRAINT "work_packages_workPackageClientId_fkey" 
      FOREIGN KEY ("workPackageClientId") 
      REFERENCES "contacts"("id") 
      ON DELETE RESTRICT 
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Add workPackageMemberId foreign key to contacts (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_packages_workPackageMemberId_fkey'
  ) THEN
    ALTER TABLE "work_packages"
      ADD CONSTRAINT "work_packages_workPackageMemberId_fkey" 
      FOREIGN KEY ("workPackageMemberId") 
      REFERENCES "contacts"("id") 
      ON DELETE SET NULL 
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 6: Make required fields NOT NULL (only after ensuring all data is migrated)
-- WARNING: These will fail if any NULL values exist
-- Uncomment these after verifying all work packages have the required data:

-- ALTER TABLE "work_packages" 
--   ALTER COLUMN "companyId" SET NOT NULL,
--   ALTER COLUMN "workPackageOwnerId" SET NOT NULL,
--   ALTER COLUMN "workPackageClientId" SET NOT NULL;

-- Step 7: Add indexes
CREATE INDEX IF NOT EXISTS "work_packages_workPackageOwnerId_idx" ON "work_packages"("workPackageOwnerId");
CREATE INDEX IF NOT EXISTS "work_packages_workPackageClientId_idx" ON "work_packages"("workPackageClientId");
CREATE INDEX IF NOT EXISTS "work_packages_workPackageMemberId_idx" ON "work_packages"("workPackageMemberId");
CREATE INDEX IF NOT EXISTS "work_packages_status_idx" ON "work_packages"("status");

-- Step 8: Remove old contactId column (after migration is verified)
-- ALTER TABLE "work_packages" DROP COLUMN IF EXISTS "contactId";
