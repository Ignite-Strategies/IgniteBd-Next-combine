-- Migration: Refactor Template System
-- Removes: template_bases, outreach_templates, template_variables
-- Refactors: templates model
-- Adds: template_relationship_helpers model

-- Step 1: Create new template_relationship_helpers table
CREATE TABLE "template_relationship_helpers" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "familiarityLevel" TEXT NOT NULL,
    "whyReachingOut" TEXT NOT NULL,
    "desiredOutcome" TEXT,
    "timeHorizon" TEXT,
    "contextNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_relationship_helpers_pkey" PRIMARY KEY ("id")
);

-- Step 2: Add foreign key for template_relationship_helpers
ALTER TABLE "template_relationship_helpers" ADD CONSTRAINT "template_relationship_helpers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 3: Create indexes for template_relationship_helpers
CREATE INDEX "template_relationship_helpers_ownerId_idx" ON "template_relationship_helpers"("ownerId");
CREATE INDEX "template_relationship_helpers_createdAt_idx" ON "template_relationship_helpers"("createdAt");

-- Step 4: Backup existing template data (if needed for migration)
-- Note: This migration assumes you've already migrated data via script
-- If not, you'll need to:
-- 1. Extract data from template_bases, outreach_templates
-- 2. Transform to new templates structure
-- 3. Insert into new templates table

-- Step 5: Drop foreign keys that reference old tables
-- Drop campaigns -> outreach_templates foreign key
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_template_id_fkey";

-- Step 6: Refactor templates table
-- First, add new columns (keeping old ones temporarily)
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- Step 7: Migrate data from old structure to new
-- Update ownerId from companyHQId
UPDATE "templates" SET "ownerId" = "companyHQId" WHERE "ownerId" IS NULL;

-- Update title from name (or generate from body if name is null)
UPDATE "templates" SET "title" = COALESCE("name", 'Untitled Template') WHERE "title" IS NULL;

-- Make subject required (set default if null)
UPDATE "templates" SET "subject" = COALESCE("subject", '') WHERE "subject" IS NULL;

-- Make body required (set default if null)
UPDATE "templates" SET "body" = COALESCE("body", '') WHERE "body" IS NULL;

-- Step 8: Change templates id to UUID with default
-- Note: This requires dropping and recreating, so we'll do it carefully
-- First, ensure all IDs are UUIDs or convert them
-- For safety, we'll keep existing ID format but add default for new records

-- Step 9: Drop old columns from templates
ALTER TABLE "templates" DROP COLUMN IF EXISTS "name";
ALTER TABLE "templates" DROP COLUMN IF EXISTS "type";
ALTER TABLE "templates" DROP COLUMN IF EXISTS "published";
ALTER TABLE "templates" DROP COLUMN IF EXISTS "publishedAt";
ALTER TABLE "templates" DROP COLUMN IF EXISTS "description";
ALTER TABLE "templates" DROP COLUMN IF EXISTS "presenter";
ALTER TABLE "templates" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "templates" DROP COLUMN IF EXISTS "companyHQId";

-- Step 10: Make new columns required
ALTER TABLE "templates" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "templates" ALTER COLUMN "subject" SET NOT NULL;
ALTER TABLE "templates" ALTER COLUMN "body" SET NOT NULL;
ALTER TABLE "templates" ALTER COLUMN "ownerId" SET NOT NULL;

-- Step 11: Add foreign key for templates.ownerId
ALTER TABLE "templates" ADD CONSTRAINT "templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 12: Update campaigns to reference templates
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 13: Drop old indexes
DROP INDEX IF EXISTS "templates_companyHQId_idx";
DROP INDEX IF EXISTS "templates_published_idx";

-- Step 14: Create new indexes
CREATE INDEX "templates_ownerId_idx" ON "templates"("ownerId");

-- Step 15: Drop old tables (DO THIS LAST, AFTER DATA MIGRATION)
-- WARNING: Only run these after you've confirmed data migration is complete!
-- DROP TABLE IF EXISTS "template_variables";
-- DROP TABLE IF EXISTS "outreach_templates";
-- DROP TABLE IF EXISTS "template_bases";

-- Step 16: Drop old enum if not used elsewhere (check first!)
-- DROP TYPE IF EXISTS "TemplateVariableType";

