-- CreateEnum
CREATE TYPE "EmailActivityKind" AS ENUM ('SENT_INITIAL', 'SENT_REPLY', 'RESPONSE');

-- AlterTable contacts: next engagement (CRM concept; replaces "remind me" for display)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "nextEngagementDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextEngagementPurpose" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_nextEngagementDate_idx" ON "contacts"("nextEngagementDate");

-- AlterTable email_activities: kind (send vs response row), inReplyTo, contactAppreciative
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "activityKind" "EmailActivityKind",
ADD COLUMN IF NOT EXISTS "inReplyToActivityId" TEXT,
ADD COLUMN IF NOT EXISTS "contactAppreciative" BOOLEAN;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_activities_inReplyToActivityId_idx" ON "email_activities"("inReplyToActivityId");

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
