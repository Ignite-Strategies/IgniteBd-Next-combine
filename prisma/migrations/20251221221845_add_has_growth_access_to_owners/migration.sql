-- Add hasGrowthAccess to company_hqs (company-level, not owner-level)
ALTER TABLE "company_hqs" ADD COLUMN "hasGrowthAccess" BOOLEAN DEFAULT false;

-- Remove hasGrowthAccess from owners if it exists (cleanup from previous approach)
-- Note: This will fail if column doesn't exist, which is fine
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owners' AND column_name = 'hasGrowthAccess'
    ) THEN
        ALTER TABLE "owners" DROP COLUMN "hasGrowthAccess";
    END IF;
END $$;

