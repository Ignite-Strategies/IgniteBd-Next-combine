-- Create simple outreach_personas table
CREATE TABLE IF NOT EXISTS "outreach_personas" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_personas_pkey" PRIMARY KEY ("id")
);

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS "outreach_personas_slug_key" ON "outreach_personas"("slug");
CREATE INDEX IF NOT EXISTS "outreach_personas_slug_idx" ON "outreach_personas"("slug");

-- Update content_snips: change bestForPersonaType (enum) to bestForPersonaSlug (string FK)
-- First, drop the old index
DROP INDEX IF EXISTS "content_snips_bestForPersonaType_idx";

-- Drop the column (enum type)
ALTER TABLE "content_snips" DROP COLUMN IF EXISTS "bestForPersonaType";

-- Add new string column for persona slug
ALTER TABLE "content_snips" ADD COLUMN IF NOT EXISTS "bestForPersonaSlug" TEXT;

-- Create foreign key to outreach_personas
ALTER TABLE "content_snips" ADD CONSTRAINT "content_snips_bestForPersonaSlug_fkey" 
    FOREIGN KEY ("bestForPersonaSlug") REFERENCES "outreach_personas"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS "content_snips_bestForPersonaSlug_idx" ON "content_snips"("bestForPersonaSlug");
