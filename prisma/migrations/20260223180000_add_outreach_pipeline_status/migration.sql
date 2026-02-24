-- CreateEnum
CREATE TYPE "OutreachPipelineStatus" AS ENUM ('NEED_TO_ENGAGE', 'ENGAGED_AWAITING_RESPONSE', 'RESPONDED');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "outreachPipelineStatus" "OutreachPipelineStatus" DEFAULT 'NEED_TO_ENGAGE';

-- CreateIndex
CREATE INDEX "contacts_outreachPipelineStatus_idx" ON "contacts"("outreachPipelineStatus");
