-- Manual migration: add Meeting model
-- Run this if prisma migrate fails due to schema drift:
-- psql $DATABASE_URL -f prisma/manual_migrations/add_meeting_model.sql

-- Add MEETING_FOLLOW_UP to NextEngagementPurpose
ALTER TYPE "NextEngagementPurpose" ADD VALUE IF NOT EXISTS 'MEETING_FOLLOW_UP';

-- Create MeetingType enum
DO $$ BEGIN
  CREATE TYPE "MeetingType" AS ENUM ('INTRO', 'FOLLOW_UP', 'PROPOSAL_REVIEW', 'CHECK_IN', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create MeetingOutcome enum
DO $$ BEGIN
  CREATE TYPE "MeetingOutcome" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_SHOW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create Meeting table
CREATE TABLE IF NOT EXISTS "Meeting" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "crmId" TEXT NOT NULL,
  "meetingDate" TIMESTAMP(3) NOT NULL,
  "meetingType" "MeetingType" NOT NULL DEFAULT 'OTHER',
  "outcome" "MeetingOutcome",
  "notes" TEXT,
  "nextAction" TEXT,
  "nextEngagementDate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_contactId_fkey" 
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_crmId_fkey" 
  FOREIGN KEY ("crmId") REFERENCES "company_hqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "Meeting_contactId_idx" ON "Meeting"("contactId");
CREATE INDEX IF NOT EXISTS "Meeting_ownerId_idx" ON "Meeting"("ownerId");
CREATE INDEX IF NOT EXISTS "Meeting_crmId_idx" ON "Meeting"("crmId");
CREATE INDEX IF NOT EXISTS "Meeting_meetingDate_idx" ON "Meeting"("meetingDate");
CREATE INDEX IF NOT EXISTS "Meeting_contactId_meetingDate_idx" ON "Meeting"("contactId", "meetingDate");
