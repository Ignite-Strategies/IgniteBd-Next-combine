-- Add hasGrowthAccess to company_hqs (company-level, not owner-level)
-- This allows different companies to have different access levels
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "hasGrowthAccess" BOOLEAN DEFAULT false;

-- Remove hasGrowthAccess from owners if it exists (cleanup from previous approach)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'owners' AND column_name = 'hasGrowthAccess'
    ) THEN
        ALTER TABLE "owners" DROP COLUMN "hasGrowthAccess";
    END IF;
END $$;

