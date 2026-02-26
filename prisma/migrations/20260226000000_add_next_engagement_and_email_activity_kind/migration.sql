-- CreateEnum: step in thread (sent / contact responded / owner response)
CREATE TYPE "EmailSequenceOrder" AS ENUM ('SENT', 'CONTACT_RESPONDED', 'OWNER_RESPONSE');

-- CreateEnum: general attitude of contact (manual; future AI infers from email)
CREATE TYPE "ContactDisposition" AS ENUM ('HAPPY_TO_RECEIVE_NOTE', 'NEUTRAL', 'DOESNT_CARE');

-- AlterTable contacts: next engagement + contact disposition (attitude)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "nextEngagementDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextEngagementPurpose" TEXT,
ADD COLUMN IF NOT EXISTS "contactDisposition" "ContactDisposition";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_nextEngagementDate_idx" ON "contacts"("nextEngagementDate");
CREATE INDEX IF NOT EXISTS "contacts_contactDisposition_idx" ON "contacts"("contactDisposition");

-- AlterTable email_activities: sequence step, inReplyTo (id ref), contactAppreciative
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "emailSequenceOrder" "EmailSequenceOrder",
ADD COLUMN IF NOT EXISTS "inReplyToActivityId" TEXT,
ADD COLUMN IF NOT EXISTS "contactAppreciative" BOOLEAN;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_activities_inReplyToActivityId_idx" ON "email_activities"("inReplyToActivityId");
CREATE INDEX IF NOT EXISTS "email_activities_emailSequenceOrder_idx" ON "email_activities"("emailSequenceOrder");

-- AddForeignKey (self-relation: response row points to send)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_activities_inReplyToActivityId_fkey'
  ) THEN
    ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_inReplyToActivityId_fkey"
      FOREIGN KEY ("inReplyToActivityId") REFERENCES "email_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: copy remindMeOn -> nextEngagementDate so existing reminders still show
UPDATE "contacts"
SET "nextEngagementDate" = "remindMeOn", "nextEngagementPurpose" = 'manual'
WHERE "remindMeOn" IS NOT NULL AND ("nextEngagementDate" IS NULL OR "nextEngagementDate" != "remindMeOn");
