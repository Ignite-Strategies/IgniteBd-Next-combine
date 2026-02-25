-- Migration: Convert bills from many-to-many (junction table) to many-to-one (direct FK)
-- Many bills → One company (reverse of plans: one plan → many companies)

-- Step 1: Add new columns to bills table
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "status" "BillSendStatus" DEFAULT 'PENDING';
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "publicBillUrl" TEXT;

-- Step 2: Migrate data from bills_to_companies to bills
-- For each bill, use the FIRST assignment (by createdAt) if multiple exist
-- This ensures each bill gets exactly one companyId
UPDATE "bills" b
SET 
  "companyId" = btc."companyId",
  "stripeCheckoutSessionId" = btc."stripeCheckoutSessionId",
  "checkoutUrl" = btc."checkoutUrl",
  "status" = btc."status",
  "slug" = btc."slug",
  "publicBillUrl" = btc."publicBillUrl"
FROM "bills_to_companies" btc
WHERE b.id = btc."billId"
  AND btc."createdAt" = (
    SELECT MIN("createdAt") FROM "bills_to_companies" WHERE "billId" = b.id
  );

-- Step 5: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bills_companyId_fkey'
  ) THEN
    ALTER TABLE "bills" ADD CONSTRAINT "bills_companyId_fkey" 
    FOREIGN KEY ("companyId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 6: Add indexes
CREATE INDEX IF NOT EXISTS "bills_companyId_idx" ON "bills"("companyId");
CREATE INDEX IF NOT EXISTS "bills_status_idx" ON "bills"("status");
CREATE INDEX IF NOT EXISTS "bills_slug_idx" ON "bills"("slug");

-- Step 7: Add unique constraint on stripeCheckoutSessionId
CREATE UNIQUE INDEX IF NOT EXISTS "bills_stripeCheckoutSessionId_key" ON "bills"("stripeCheckoutSessionId") WHERE "stripeCheckoutSessionId" IS NOT NULL;

-- Step 8: Add unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS "bills_slug_key" ON "bills"("slug") WHERE "slug" IS NOT NULL;

-- Step 9: Drop the junction table (after data migration)
DROP TABLE IF EXISTS "bills_to_companies";
