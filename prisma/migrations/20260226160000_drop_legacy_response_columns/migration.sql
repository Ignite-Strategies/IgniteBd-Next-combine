-- Drop legacy response-on-same-row columns; use responseFromEmail + thread row instead
DROP INDEX IF EXISTS "email_activities_hasResponded_idx";
ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "hasResponded";
ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "contactResponse";
ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "respondedAt";
ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "responseSubject";
