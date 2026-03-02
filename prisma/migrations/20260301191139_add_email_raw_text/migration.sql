-- Add emailRawText column to email_activities for inbound email ingestion
ALTER TABLE "email_activities" ADD COLUMN IF NOT EXISTS "emailRawText" TEXT;
