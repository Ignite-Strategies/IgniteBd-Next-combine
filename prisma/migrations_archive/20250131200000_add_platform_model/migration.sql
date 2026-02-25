-- CreateTable
CREATE TABLE IF NOT EXISTS "platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_pkey" PRIMARY KEY ("id")
);

-- Create default platform record
INSERT INTO "platform" (id, name, "createdAt", "updatedAt")
VALUES ('platform-ignitebd-001', 'IgniteBD Platform', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Add platformId column to company_hqs (nullable first)
ALTER TABLE "company_hqs" ADD COLUMN IF NOT EXISTS "platformId" TEXT;

-- Update all existing company_hqs to use default platform
UPDATE "company_hqs" 
SET "platformId" = 'platform-ignitebd-001' 
WHERE "platformId" IS NULL;

-- Make platformId required
ALTER TABLE "company_hqs" ALTER COLUMN "platformId" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_hqs_platformId_idx" ON "company_hqs"("platformId");

-- AddForeignKey
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

