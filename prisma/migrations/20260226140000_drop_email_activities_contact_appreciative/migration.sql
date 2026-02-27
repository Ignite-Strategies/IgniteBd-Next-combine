-- Drop contactAppreciative from email_activities (overbuilt; remove)
ALTER TABLE "email_activities" DROP COLUMN IF EXISTS "contactAppreciative";
