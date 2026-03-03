-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "companyHQId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboundEmail_companyHQId_idx" ON "InboundEmail"("companyHQId");

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
