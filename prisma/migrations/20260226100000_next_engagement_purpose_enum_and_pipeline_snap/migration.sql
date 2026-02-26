-- NextEngagementPurpose enum (no "manual" — use GENERAL_CHECK_IN for user-set / remind-me)
CREATE TYPE "NextEngagementPurpose" AS ENUM ('GENERAL_CHECK_IN', 'UNRESPONSIVE', 'PERIODIC_CHECK_IN', 'REFERRAL_NO_CONTACT');

-- Add pipeline snap columns to contacts (cadence reads from contact only)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "pipelineSnap" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "pipelineStageSnap" TEXT;

-- Convert nextEngagementPurpose from TEXT to enum (preserve data)
ALTER TABLE "contacts" ALTER COLUMN "nextEngagementPurpose" TYPE "NextEngagementPurpose" USING (
  CASE "nextEngagementPurpose"
    WHEN 'manual' THEN 'GENERAL_CHECK_IN'::"NextEngagementPurpose"
    WHEN 'unresponsive' THEN 'UNRESPONSIVE'::"NextEngagementPurpose"
    WHEN 'periodic_check_in' THEN 'PERIODIC_CHECK_IN'::"NextEngagementPurpose"
    WHEN 'referral_no_contact' THEN 'REFERRAL_NO_CONTACT'::"NextEngagementPurpose"
    ELSE NULL
  END
);

-- Backfill pipeline snap from pipelines table so cadence can read from contact
UPDATE "contacts" c
SET "pipelineSnap" = p.pipeline, "pipelineStageSnap" = p.stage
FROM "pipelines" p
WHERE p."contactId" = c.id;
