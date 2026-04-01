-- Repair enum drift: schema + app use SCHEDULED_MEETING / MEETING_FOLLOW_UP but some databases
-- never applied earlier ALTER TYPE migrations (or shadow DB was reset). Idempotent via pg_enum.

DO $$
DECLARE
  typ oid;
BEGIN
  SELECT t.oid INTO typ
  FROM pg_type t
  INNER JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typname = 'NextEngagementPurpose'
    AND n.nspname = current_schema();

  IF typ IS NULL THEN
    RAISE EXCEPTION 'NextEngagementPurpose enum type not found (expected on public schema)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = typ AND enumlabel = 'MEETING_FOLLOW_UP'
  ) THEN
    ALTER TYPE "NextEngagementPurpose" ADD VALUE 'MEETING_FOLLOW_UP';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = typ AND enumlabel = 'SCHEDULED_MEETING'
  ) THEN
    ALTER TYPE "NextEngagementPurpose" ADD VALUE 'SCHEDULED_MEETING';
  END IF;
END $$;
