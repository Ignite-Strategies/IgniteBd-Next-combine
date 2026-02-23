-- Remove relationship context FK from snippets - snippets are independent building blocks
-- Relationship context will be used by assembly service, not stored on snippets

-- Drop foreign key and index
ALTER TABLE "content_snips" DROP CONSTRAINT IF EXISTS "content_snips_relationshipContextId_fkey";
DROP INDEX IF EXISTS "content_snips_relationshipContextId_idx";

-- Remove relationshipContextId column
ALTER TABLE "content_snips" DROP COLUMN IF EXISTS "relationshipContextId";

-- Add bestForPersonaType column (optional hint)
ALTER TABLE "content_snips" ADD COLUMN IF NOT EXISTS "bestForPersonaType" "PersonaType";

-- Create index for persona type filtering
CREATE INDEX IF NOT EXISTS "content_snips_bestForPersonaType_idx" ON "content_snips"("bestForPersonaType");
