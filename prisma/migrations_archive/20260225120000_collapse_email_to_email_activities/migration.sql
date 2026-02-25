-- Collapse to single email_activities model (platform + off-platform + response)
-- Step 1: Add new columns to email_activities
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "source" "EmailSource" DEFAULT 'PLATFORM';
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "hasResponded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "contactResponse" TEXT;
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "responseSubject" TEXT;
UPDATE "email_activities" SET "source" = 'PLATFORM' WHERE "source" IS NULL;

-- Step 2: Make existing columns nullable (for off-platform sends)
ALTER TABLE "email_activities" ALTER COLUMN "messageId" DROP NOT NULL;
ALTER TABLE "email_activities" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "email_activities" ALTER COLUMN "subject" DROP NOT NULL;
ALTER TABLE "email_activities" ALTER COLUMN "body" DROP NOT NULL;

-- Step 3: Drop unique constraint on messageId if it exists (to allow multiple nulls), then re-add unique only for non-null
-- PostgreSQL: unique constraint allows multiple NULLs by default, so we may only need to alter the column.
-- If the constraint was UNIQUE NOT NULL, we need to drop and re-add. Checking: Prisma @unique allows multiple nulls in PG.
-- No change needed for messageId unique.

-- Step 4: Indexes for new columns
CREATE INDEX IF NOT EXISTS "email_activities_source_idx" ON "email_activities"("source");
CREATE INDEX IF NOT EXISTS "email_activities_sentAt_idx" ON "email_activities"("sentAt");
CREATE INDEX IF NOT EXISTS "email_activities_hasResponded_idx" ON "email_activities"("hasResponded");

-- NOTE: Tables "emails" and "off_platform_email_sends" are no longer in the schema.
-- Run a data migration to copy existing data into email_activities if needed, then drop those tables in a follow-up migration.
