-- Consolidate PlatformAccess into company_hqs
-- This migration:
-- 1. Adds plan fields to company_hqs
-- 2. Migrates existing PlatformAccess data
-- 3. Drops platform_accesses table

-- Step 1: Add plan fields to company_hqs (nullable first)
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "planStatus" TEXT;
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "planStartedAt" TIMESTAMP(3);
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "planEndedAt" TIMESTAMP(3);

-- Step 2: Migrate existing PlatformAccess data to company_hqs
-- Update company_hqs with data from platform_accesses
UPDATE "company_hqs" 
SET 
  "planId" = pa."planId",
  "planStatus" = pa."status",
  "stripeSubscriptionId" = pa."stripeSubscriptionId",
  "planStartedAt" = pa."startedAt",
  "planEndedAt" = pa."endedAt"
FROM "platform_accesses" pa
WHERE "company_hqs"."id" = pa."companyId"
  AND pa."status" = 'ACTIVE'
  AND ("company_hqs"."planId" IS NULL OR "company_hqs"."planId" = pa."planId");

-- Step 3: Make planId required (but first ensure all companies have a default plan)
-- Create a default plan if it doesn't exist
INSERT INTO "plans" (id, name, "amountCents", currency, "createdAt", "updatedAt")
VALUES ('default-plan-001', 'Default Plan', 0, 'usd', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Set default plan for companies without a plan
UPDATE "company_hqs"
SET "planId" = 'default-plan-001'
WHERE "planId" IS NULL;

-- Step 4: Make planId required and add foreign key
ALTER TABLE "company_hqs" ALTER COLUMN "planId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_planId_fkey" 
  FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Add indexes
CREATE INDEX IF NOT EXISTS "company_hqs_planId_idx" ON "company_hqs"("planId");
CREATE INDEX IF NOT EXISTS "company_hqs_planStatus_idx" ON "company_hqs"("planStatus");
CREATE INDEX IF NOT EXISTS "company_hqs_stripeSubscriptionId_idx" ON "company_hqs"("stripeSubscriptionId");

-- Step 6: Drop platform_accesses table (after data migration)
DROP TABLE IF EXISTS "platform_accesses";

