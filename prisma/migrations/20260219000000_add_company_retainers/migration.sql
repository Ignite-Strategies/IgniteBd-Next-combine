-- Company-specific recurring retainers (isolated from universal plans)

-- Create enum types
DO $$ BEGIN
  CREATE TYPE "RetainerStatus" AS ENUM ('DRAFT', 'LINK_SENT', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RetainerInterval" AS ENUM ('MONTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS "company_retainers" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "interval" "RetainerInterval" NOT NULL DEFAULT 'MONTH',
  "startDate" TIMESTAMP(3),
  "status" "RetainerStatus" NOT NULL DEFAULT 'DRAFT',
  "slug" TEXT,
  "publicRetainerUrl" TEXT,
  "stripeSubscriptionId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_retainers_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "company_retainers_slug_key" ON "company_retainers"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "company_retainers_stripeSubscriptionId_key" ON "company_retainers"("stripeSubscriptionId");

-- Secondary indexes
CREATE INDEX IF NOT EXISTS "company_retainers_companyId_idx" ON "company_retainers"("companyId");
CREATE INDEX IF NOT EXISTS "company_retainers_status_idx" ON "company_retainers"("status");
CREATE INDEX IF NOT EXISTS "company_retainers_slug_idx" ON "company_retainers"("slug");
CREATE INDEX IF NOT EXISTS "company_retainers_stripeSubscriptionId_idx" ON "company_retainers"("stripeSubscriptionId");

-- FK
DO $$ BEGIN
  ALTER TABLE "company_retainers"
  ADD CONSTRAINT "company_retainers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
