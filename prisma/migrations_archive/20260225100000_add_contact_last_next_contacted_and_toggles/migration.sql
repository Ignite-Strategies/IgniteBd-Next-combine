-- AlterTable
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "nextContactedAt" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "nextContactNote" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "doNotContactAgain" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_lastContactedAt_idx" ON "contacts"("lastContactedAt");
CREATE INDEX IF NOT EXISTS "contacts_nextContactedAt_idx" ON "contacts"("nextContactedAt");
CREATE INDEX IF NOT EXISTS "contacts_doNotContactAgain_idx" ON "contacts"("doNotContactAgain");
