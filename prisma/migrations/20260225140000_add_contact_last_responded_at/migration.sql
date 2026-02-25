-- AlterTable
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "lastRespondedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_lastRespondedAt_idx" ON "contacts"("lastRespondedAt");
