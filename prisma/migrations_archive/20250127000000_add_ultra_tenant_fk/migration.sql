-- AlterTable
ALTER TABLE "company_hqs" ADD COLUMN "ultraTenantId" TEXT;

-- AddForeignKey
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_ultraTenantId_fkey" FOREIGN KEY ("ultraTenantId") REFERENCES "company_hqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

