-- Rename bd_event_opps to bd_eventop_intel
ALTER TABLE "bd_event_opps" RENAME TO "bd_eventop_intel";

-- Create new bd_event_ops table
CREATE TABLE "bd_event_ops" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "eventPlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "whyGo" TEXT,
    "eventType" "EventType" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "costBand" TEXT,
    "source" "EventSource" NOT NULL DEFAULT 'MANUAL',
    "status" "EventOppStatus" NOT NULL DEFAULT 'CONSIDERING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bd_event_ops_pkey" PRIMARY KEY ("id")
);

-- Create EventSource enum if it doesn't exist
DO $$ BEGIN
 CREATE TYPE "EventSource" AS ENUM('PERSONA', 'USER_PREF', 'MANUAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for bd_event_ops
CREATE INDEX "bd_event_ops_companyHQId_idx" ON "bd_event_ops"("companyHQId");
CREATE INDEX "bd_event_ops_ownerId_idx" ON "bd_event_ops"("ownerId");
CREATE INDEX "bd_event_ops_eventPlanId_idx" ON "bd_event_ops"("eventPlanId");
CREATE INDEX "bd_event_ops_status_idx" ON "bd_event_ops"("status");
CREATE INDEX "bd_event_ops_source_idx" ON "bd_event_ops"("source");

-- Add foreign key relation from event_plan_opps to bd_event_ops
ALTER TABLE "event_plan_opps" ADD CONSTRAINT "event_plan_opps_bdEventOppId_fkey" FOREIGN KEY ("bdEventOppId") REFERENCES "bd_event_ops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key relation from bd_eventop_intel to event_metas (if not already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bd_eventop_intel_eventMetaId_fkey'
    ) THEN
        ALTER TABLE "bd_eventop_intel" 
        ADD CONSTRAINT "bd_eventop_intel_eventMetaId_fkey" 
        FOREIGN KEY ("eventMetaId") REFERENCES "event_metas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

