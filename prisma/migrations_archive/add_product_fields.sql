-- Add new fields to products table
-- Run this migration manually or via Prisma migrate

ALTER TABLE "products" 
  ADD COLUMN IF NOT EXISTS "pricingModel" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryTimeline" TEXT,
  ADD COLUMN IF NOT EXISTS "targetMarketSize" TEXT,
  ADD COLUMN IF NOT EXISTS "salesCycleLength" TEXT,
  ADD COLUMN IF NOT EXISTS "features" TEXT,
  ADD COLUMN IF NOT EXISTS "competitiveAdvantages" TEXT;

-- Add comments for documentation
COMMENT ON COLUMN "products"."pricingModel" IS 'one-time, recurring, usage-based, freemium, custom';
COMMENT ON COLUMN "products"."targetMarketSize" IS 'enterprise, mid-market, small-business, startup, individual';
COMMENT ON COLUMN "products"."salesCycleLength" IS 'immediate, short, medium, long, very-long';

