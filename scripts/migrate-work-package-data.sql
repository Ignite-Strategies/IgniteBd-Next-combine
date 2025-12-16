-- Data Migration Script for Work Package Refactor
-- Run this AFTER the schema has been pushed to migrate existing data

-- Step 1: Migrate data - copy contactId to workPackageClientId (if column still exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'work_packages' AND column_name = 'contactId') THEN
    UPDATE "work_packages" 
    SET "workPackageClientId" = "contactId"
    WHERE "workPackageClientId" IS NULL AND "contactId" IS NOT NULL;
    
    RAISE NOTICE 'Migrated contactId to workPackageClientId';
  ELSE
    RAISE NOTICE 'contactId column does not exist, skipping migration';
  END IF;
END $$;

-- Step 2: Auto-populate companyId from contact's company where missing
UPDATE "work_packages" wp
SET "companyId" = c."contactCompanyId"
FROM "contacts" c
WHERE wp."workPackageClientId" = c.id
  AND wp."companyId" IS NULL
  AND c."contactCompanyId" IS NOT NULL;

-- Step 3: Auto-populate workPackageOwnerId from company's companyHQId
UPDATE "work_packages" wp
SET "workPackageOwnerId" = comp."companyHQId"
FROM "companies" comp
WHERE wp."companyId" = comp.id
  AND wp."workPackageOwnerId" IS NULL
  AND comp."companyHQId" IS NOT NULL;

-- Step 4: Verify migration - check for any NULL values in required fields
SELECT 
  COUNT(*) as total_work_packages,
  COUNT("companyId") as has_company_id,
  COUNT("workPackageOwnerId") as has_owner_id,
  COUNT("workPackageClientId") as has_client_id,
  COUNT(*) FILTER (WHERE "companyId" IS NULL) as missing_company_id,
  COUNT(*) FILTER (WHERE "workPackageOwnerId" IS NULL) as missing_owner_id,
  COUNT(*) FILTER (WHERE "workPackageClientId" IS NULL) as missing_client_id
FROM "work_packages";
