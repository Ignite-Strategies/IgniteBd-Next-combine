-- AlterTable
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "tier" TEXT DEFAULT 'foundation';

-- Update existing owners to have foundation tier
UPDATE "owners" SET "tier" = 'foundation' WHERE "tier" IS NULL OR "tier" = '';

