-- Add paidAt field to bills table
-- This tracks when payment was received (set by Stripe webhook)

ALTER TABLE "bills" ADD COLUMN "paidAt" TIMESTAMP;

-- Add index for filtering/sorting by payment date
CREATE INDEX IF NOT EXISTS "bills_paidAt_idx" ON "bills"("paidAt");

-- Backfill: Set paidAt = updatedAt for bills with status = 'PAID'
-- (for bills that were paid before this migration)
UPDATE "bills" 
SET "paidAt" = "updatedAt" 
WHERE "status" = 'PAID' AND "paidAt" IS NULL;
