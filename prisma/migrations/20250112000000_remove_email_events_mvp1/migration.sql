-- Remove email_events table and EmailEventType enum for MVP1 simplification
-- We're using email_activities.event field instead for latest event state

-- Drop foreign key constraint first
ALTER TABLE "email_events" DROP CONSTRAINT IF EXISTS "email_events_email_activity_id_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "email_events_email_activity_id_event_type_idx";
DROP INDEX IF EXISTS "email_events_email_activity_id_idx";
DROP INDEX IF EXISTS "email_events_event_type_idx";
DROP INDEX IF EXISTS "email_events_occurred_at_idx";

-- Drop the table
DROP TABLE IF EXISTS "email_events";

-- Drop the enum (if not used elsewhere)
DROP TYPE IF EXISTS "EmailEventType";

-- Remove the relation from email_activities (already removed from schema, this is just cleanup)
-- Note: The relation field was removed from Prisma schema, but if there's a constraint in DB, it's already handled above

