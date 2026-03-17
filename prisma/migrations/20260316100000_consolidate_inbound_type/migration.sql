-- Consolidate: single InboundEmail model with inboundType (OUTREACH | MEETING). Drop RawMeetingNotes.
-- CreateEnum
CREATE TYPE "InboundType" AS ENUM ('OUTREACH', 'MEETING');

-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN "inboundType" "InboundType" NOT NULL DEFAULT 'OUTREACH';

-- CreateIndex (ignore if exists for idempotency)
CREATE INDEX IF NOT EXISTS "InboundEmail_inboundType_idx" ON "InboundEmail"("inboundType");

-- Drop RawMeetingNotes (no longer used)
DROP TABLE IF EXISTS "RawMeetingNotes";
