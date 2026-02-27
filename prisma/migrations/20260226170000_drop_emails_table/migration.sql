-- Drop legacy "emails" table (unified model from before collapse to email_activities).
-- Drop "off_platform_email_sends" if it exists (old off-platform table; everything now in email_activities).
DROP TABLE IF EXISTS "emails" CASCADE;
DROP TABLE IF EXISTS "off_platform_email_sends" CASCADE;
