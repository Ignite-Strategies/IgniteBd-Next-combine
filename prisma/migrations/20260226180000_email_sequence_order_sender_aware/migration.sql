-- Replace EmailSequenceOrder with sender-aware: OWNER_SEND | CONTACT_SEND
CREATE TYPE "EmailSequenceOrder_new" AS ENUM ('OWNER_SEND', 'CONTACT_SEND');

ALTER TABLE "email_activities" ADD COLUMN "emailSequenceOrder_new" "EmailSequenceOrder_new";

UPDATE "email_activities"
SET "emailSequenceOrder_new" = 'OWNER_SEND'
WHERE "emailSequenceOrder" IN ('SENT', 'OWNER_RESPONSE');

UPDATE "email_activities"
SET "emailSequenceOrder_new" = 'CONTACT_SEND'
WHERE "emailSequenceOrder" = 'CONTACT_RESPONDED';

ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "emailSequenceOrder";
ALTER TABLE "email_activities" RENAME COLUMN "emailSequenceOrder_new" TO "emailSequenceOrder";

DROP TYPE IF EXISTS "EmailSequenceOrder";
ALTER TYPE "EmailSequenceOrder_new" RENAME TO "EmailSequenceOrder";

CREATE INDEX IF NOT EXISTS "email_activities_emailSequenceOrder_idx" ON "email_activities"("emailSequenceOrder");
