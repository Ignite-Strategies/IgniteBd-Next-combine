-- Rename companyId to crmId in contacts table for clarity
-- companyId was confusing because it's actually CompanyHQId (tenant identifier)
-- crmId makes it clear this is the CRM/tenant identifier, not the company they work for

-- Handle the transition: if companyId exists, rename it to crmId
-- If crmId already exists, do nothing (idempotent)
DO $$
BEGIN
    -- Check if companyId column exists and crmId doesn't exist
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'companyId'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'crmId'
    ) THEN
        -- Rename the column (preserves all data)
        ALTER TABLE "contacts" RENAME COLUMN "companyId" TO "crmId";
    END IF;
END $$;

