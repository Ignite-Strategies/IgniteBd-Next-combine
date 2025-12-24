-- Remove hasGrowthAccess column from company_hqs (no longer gating access)
-- Keep tier field for future use (not gated)
ALTER TABLE "company_hqs" DROP COLUMN IF EXISTS "hasGrowthAccess";

