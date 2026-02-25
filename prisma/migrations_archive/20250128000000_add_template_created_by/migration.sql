-- Migration: Add createdBy field to Template model
-- This field tracks which owner (owners.id) created the template for auth purposes

-- Add createdBy column (nullable, references owners.id)
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- Add foreign key constraint
ALTER TABLE "templates" 
ADD CONSTRAINT "templates_createdBy_fkey" 
FOREIGN KEY ("createdBy") 
REFERENCES "owners"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "templates_createdBy_idx" ON "templates"("createdBy");

