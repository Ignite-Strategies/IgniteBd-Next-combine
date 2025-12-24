-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('EMAIL', 'SEQUENCE', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('SENT', 'DELIVERED', 'OPEN', 'CLICK', 'REPLY', 'BOUNCE', 'DROP', 'DEFERRED', 'UNSUBSCRIBE', 'SPAM_REPORT');

-- AlterTable
ALTER TABLE "email_activities" 
ADD COLUMN "campaign_id" TEXT,
ADD COLUMN "sequence_id" TEXT,
ADD COLUMN "sequence_step_id" TEXT,
ADD COLUMN "reply_to_message_id" TEXT;

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "company_hq_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "CampaignType" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "preview_text" TEXT,
    "from_email" TEXT,
    "from_name" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "emails_sent" INTEGER NOT NULL DEFAULT 0,
    "emails_delivered" INTEGER NOT NULL DEFAULT 0,
    "emails_opened" INTEGER NOT NULL DEFAULT 0,
    "emails_clicked" INTEGER NOT NULL DEFAULT 0,
    "emails_replied" INTEGER NOT NULL DEFAULT 0,
    "emails_bounced" INTEGER NOT NULL DEFAULT 0,
    "open_rate" DOUBLE PRECISION,
    "click_rate" DOUBLE PRECISION,
    "reply_rate" DOUBLE PRECISION,
    "bounce_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "company_hq_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFT',
    "auto_pause_on_reply" BOOLEAN NOT NULL DEFAULT true,
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "emails_sent" INTEGER NOT NULL DEFAULT 0,
    "emails_opened" INTEGER NOT NULL DEFAULT 0,
    "emails_clicked" INTEGER NOT NULL DEFAULT 0,
    "emails_replied" INTEGER NOT NULL DEFAULT 0,
    "open_rate" DOUBLE PRECISION,
    "click_rate" DOUBLE PRECISION,
    "reply_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" TEXT NOT NULL,
    "sequence_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "name" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "delay_days" INTEGER NOT NULL DEFAULT 0,
    "delay_hours" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "from_email" TEXT,
    "from_name" TEXT,
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_opened" INTEGER NOT NULL DEFAULT 0,
    "total_clicked" INTEGER NOT NULL DEFAULT 0,
    "total_replied" INTEGER NOT NULL DEFAULT 0,
    "open_rate" DOUBLE PRECISION,
    "click_rate" DOUBLE PRECISION,
    "reply_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "email_activity_id" TEXT NOT NULL,
    "event_type" "EmailEventType" NOT NULL,
    "event_data" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "location" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_activities_campaign_id_idx" ON "email_activities"("campaign_id");

-- CreateIndex
CREATE INDEX "email_activities_sequence_id_idx" ON "email_activities"("sequence_id");

-- CreateIndex
CREATE INDEX "email_activities_contact_id_createdAt_idx" ON "email_activities"("contact_id", "createdAt");

-- CreateIndex
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns"("owner_id");

-- CreateIndex
CREATE INDEX "campaigns_company_hq_id_idx" ON "campaigns"("company_hq_id");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at");

-- CreateIndex
CREATE INDEX "email_sequences_owner_id_idx" ON "email_sequences"("owner_id");

-- CreateIndex
CREATE INDEX "email_sequences_campaign_id_idx" ON "email_sequences"("campaign_id");

-- CreateIndex
CREATE INDEX "email_sequences_status_idx" ON "email_sequences"("status");

-- CreateIndex
CREATE INDEX "sequence_steps_sequence_id_idx" ON "sequence_steps"("sequence_id");

-- CreateIndex
CREATE INDEX "sequence_steps_sequence_id_step_number_idx" ON "sequence_steps"("sequence_id", "step_number");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_steps_sequence_id_step_number_key" ON "sequence_steps"("sequence_id", "step_number");

-- CreateIndex
CREATE INDEX "email_events_email_activity_id_idx" ON "email_events"("email_activity_id");

-- CreateIndex
CREATE INDEX "email_events_event_type_idx" ON "email_events"("event_type");

-- CreateIndex
CREATE INDEX "email_events_occurred_at_idx" ON "email_events"("occurred_at");

-- CreateIndex
CREATE INDEX "email_events_email_activity_id_event_type_idx" ON "email_events"("email_activity_id", "event_type");

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_sequence_step_id_fkey" FOREIGN KEY ("sequence_step_id") REFERENCES "sequence_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_hq_id_fkey" FOREIGN KEY ("company_hq_id") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_company_hq_id_fkey" FOREIGN KEY ("company_hq_id") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_activity_id_fkey" FOREIGN KEY ("email_activity_id") REFERENCES "email_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

