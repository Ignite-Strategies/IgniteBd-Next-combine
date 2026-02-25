-- Add companyName column to contacts table
-- Company name from enrichment (e.g., Lusha, Clearbit)
-- This is separate from contactCompany relation - it's the raw enrichment data

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "companyName" TEXT;

-- Create index for companyName lookups
CREATE INDEX IF NOT EXISTS idx_contacts_companyName ON contacts("companyName") WHERE "companyName" IS NOT NULL;
