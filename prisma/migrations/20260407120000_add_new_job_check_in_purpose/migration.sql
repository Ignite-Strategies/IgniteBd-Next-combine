-- Add NEW_JOB_CHECK_IN to NextEngagementPurpose (idempotent)

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
    RAISE EXCEPTION 'NextEngagementPurpose enum type not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = typ AND enumlabel = 'NEW_JOB_CHECK_IN'
  ) THEN
    ALTER TYPE "NextEngagementPurpose" ADD VALUE 'NEW_JOB_CHECK_IN';
  END IF;
END $$;
