-- Replace inReplyToActivityId with responseFromEmail (id stamp on parent, no FK)
ALTER TABLE "email_activities" DROP CONSTRAINT IF EXISTS "email_activities_inReplyToActivityId_fkey";
DROP INDEX IF EXISTS "email_activities_inReplyToActivityId_idx";
ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "inReplyToActivityId";

-- If schema was already renamed to repliesTo in a prior migration, drop that too
ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "repliesTo";

ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "responseFromEmail" TEXT;
CREATE INDEX IF NOT EXISTS "email_activities_responseFromEmail_idx" ON "email_activities"("responseFromEmail");
