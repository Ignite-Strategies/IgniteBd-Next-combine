-- Change snippets to use assemblyHelperPersonas array instead of single bestForPersonaSlug
-- Add outreachPersonaSlug to contacts for persona assignment

-- 1. Drop old FK and index from content_snips
ALTER TABLE "content_snips" DROP CONSTRAINT IF EXISTS "content_snips_bestForPersonaSlug_fkey";
DROP INDEX IF EXISTS "content_snips_bestForPersonaSlug_idx";

-- 2. Drop bestForPersonaSlug column
ALTER TABLE "content_snips" DROP COLUMN IF EXISTS "bestForPersonaSlug";

-- 3. Add assemblyHelperPersonas array column
ALTER TABLE "content_snips" ADD COLUMN IF NOT EXISTS "assemblyHelperPersonas" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 4. Add outreachPersonaSlug to contacts
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "outreachPersonaSlug" TEXT;

-- 5. Add FK from contacts to outreach_personas
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_outreachPersonaSlug_fkey" 
    FOREIGN KEY ("outreachPersonaSlug") REFERENCES "outreach_personas"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Create index on contact persona
CREATE INDEX IF NOT EXISTS "contacts_outreachPersonaSlug_idx" ON "contacts"("outreachPersonaSlug");
