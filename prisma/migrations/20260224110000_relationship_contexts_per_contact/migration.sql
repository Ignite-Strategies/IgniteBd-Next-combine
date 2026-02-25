-- Relationship contexts: per-contact (contactId) instead of lookup table (contextKey).
-- Run delete-old-relationship-context-lookups.js first so the table is empty.

-- Drop old indexes and unique on contextKey
DROP INDEX IF EXISTS "relationship_contexts_contextKey_idx";
DROP INDEX IF EXISTS "relationship_contexts_contextKey_key";

-- Add contactId (required, unique). Table is empty so no default needed.
ALTER TABLE "relationship_contexts" ADD COLUMN "contactId" TEXT;

-- Make enum columns nullable
ALTER TABLE "relationship_contexts" ALTER COLUMN "contextOfRelationship" DROP NOT NULL;
ALTER TABLE "relationship_contexts" ALTER COLUMN "relationshipRecency" DROP NOT NULL;
ALTER TABLE "relationship_contexts" ALTER COLUMN "companyAwareness" DROP NOT NULL;

-- Drop contextKey
ALTER TABLE "relationship_contexts" DROP COLUMN IF EXISTS "contextKey";

-- Add factual columns
ALTER TABLE "relationship_contexts" ADD COLUMN IF NOT EXISTS "formerCompany" TEXT;
ALTER TABLE "relationship_contexts" ADD COLUMN IF NOT EXISTS "primaryWork" TEXT;
ALTER TABLE "relationship_contexts" ADD COLUMN IF NOT EXISTS "relationshipQuality" TEXT;
ALTER TABLE "relationship_contexts" ADD COLUMN IF NOT EXISTS "opportunityType" TEXT;

-- Enforce NOT NULL on contactId (table is empty after delete script)
ALTER TABLE "relationship_contexts" ALTER COLUMN "contactId" SET NOT NULL;
CREATE UNIQUE INDEX "relationship_contexts_contactId_key" ON "relationship_contexts"("contactId");
CREATE INDEX "relationship_contexts_contactId_idx" ON "relationship_contexts"("contactId");

-- FK to contacts
ALTER TABLE "relationship_contexts" ADD CONSTRAINT "relationship_contexts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop contact.relationshipContextId if it exists (no longer used)
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "relationshipContextId";
