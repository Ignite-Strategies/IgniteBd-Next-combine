-- CreateEnum
CREATE TYPE "IntroPositionInTarget" AS ENUM ('DECISION_MAKER', 'INTRO_WITHIN_TARGET', 'GATEKEEPER', 'INFLUENCER', 'OTHER');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "introPositionInTarget" "IntroPositionInTarget" NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_introPositionInTarget_idx" ON "contacts"("introPositionInTarget");
