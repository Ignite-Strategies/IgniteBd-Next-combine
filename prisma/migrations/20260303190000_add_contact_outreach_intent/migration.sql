-- CreateEnum
CREATE TYPE "ContactOutreachIntent" AS ENUM ('PROSPECT', 'TARGET');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "outreachIntent" "ContactOutreachIntent" DEFAULT 'PROSPECT';

-- CreateIndex
CREATE INDEX "contacts_outreachIntent_idx" ON "contacts"("outreachIntent");
