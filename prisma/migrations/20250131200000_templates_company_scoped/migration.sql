-- Migration: Templates Company-Scoped (Option 2)
-- Changes:
-- 1. Make companyHQId required (was optional)
-- 2. Make ownerId optional (was required) - keep as creator/audit trail
-- 3. Backfill companyHQId from owner's companyHQ for existing templates
-- 4. Match pattern: phase_templates, deliverable_templates (company-scoped, no ownerId required)

-- Step 1: Backfill companyHQId from owner's companyHQ for existing templates
-- Get owner's primary companyHQ from memberships
UPDATE "templates" t
SET "companyHQId" = (
  SELECT cm."companyHqId"
  FROM "company_memberships" cm
  WHERE cm."userId" = t."ownerId"
  ORDER BY 
    CASE cm."role" WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2 ELSE 3 END,
    cm."createdAt" ASC
  LIMIT 1
)
WHERE t."companyHQId" IS NULL
  AND t."ownerId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "company_memberships" cm
    WHERE cm."userId" = t."ownerId"
  );

-- Step 2: Make companyHQId required
-- First ensure all templates have companyHQId (delete any that don't - they're orphaned)
DELETE FROM "templates" WHERE "companyHQId" IS NULL;

-- Step 3: Add NOT NULL constraint to companyHQId
ALTER TABLE "templates" ALTER COLUMN "companyHQId" SET NOT NULL;

-- Step 4: Update foreign key constraint for company_hqs (ensure it's not nullable)
ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "templates_companyHQId_fkey";
ALTER TABLE "templates" ADD CONSTRAINT "templates_companyHQId_fkey" 
  FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Make ownerId optional (drop NOT NULL constraint)
ALTER TABLE "templates" ALTER COLUMN "ownerId" DROP NOT NULL;

-- Step 6: Update foreign key constraint for owners (change onDelete to SetNull since it's optional)
ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "templates_ownerId_fkey";
ALTER TABLE "templates" ADD CONSTRAINT "templates_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Ensure indexes exist
CREATE INDEX IF NOT EXISTS "templates_companyHQId_idx" ON "templates"("companyHQId");
CREATE INDEX IF NOT EXISTS "templates_ownerId_idx" ON "templates"("ownerId");
