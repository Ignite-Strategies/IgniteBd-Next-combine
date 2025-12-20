-- Add contact_list_id to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "contact_list_id" TEXT;

-- Add new columns to contact_lists table
ALTER TABLE "contact_lists" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'static';
ALTER TABLE "contact_lists" ADD COLUMN IF NOT EXISTS "filters" JSONB;
ALTER TABLE "contact_lists" ADD COLUMN IF NOT EXISTS "totalContacts" INTEGER DEFAULT 0;
ALTER TABLE "contact_lists" ADD COLUMN IF NOT EXISTS "lastUpdated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "contact_lists" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "contact_lists" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Update existing contact_lists to have default values
UPDATE "contact_lists" SET "type" = 'static' WHERE "type" IS NULL;
UPDATE "contact_lists" SET "totalContacts" = 0 WHERE "totalContacts" IS NULL;
UPDATE "contact_lists" SET "lastUpdated" = CURRENT_TIMESTAMP WHERE "lastUpdated" IS NULL;
UPDATE "contact_lists" SET "isActive" = true WHERE "isActive" IS NULL;
UPDATE "contact_lists" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- Add foreign key constraint from campaigns to contact_lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'campaigns_contact_list_id_fkey'
  ) THEN
    ALTER TABLE "campaigns" 
    ADD CONSTRAINT "campaigns_contact_list_id_fkey" 
    FOREIGN KEY ("contact_list_id") 
    REFERENCES "contact_lists"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add index on contact_list_id
CREATE INDEX IF NOT EXISTS "campaigns_contact_list_id_idx" ON "campaigns"("contact_list_id");

-- Add unique constraint on (companyId, name) for contact_lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contact_lists_companyId_name_key'
  ) THEN
    ALTER TABLE "contact_lists" 
    ADD CONSTRAINT "contact_lists_companyId_name_key" 
    UNIQUE ("companyId", "name");
  END IF;
END $$;

-- Add index on isActive for contact_lists
CREATE INDEX IF NOT EXISTS "contact_lists_isActive_idx" ON "contact_lists"("isActive");

-- Calculate totalContacts for existing contact_lists
UPDATE "contact_lists" cl
SET "totalContacts" = (
  SELECT COUNT(*) 
  FROM "contacts" c 
  WHERE c."contactListId" = cl."id"
);

