-- CreateEnum
CREATE TYPE "EngagementLogEntryType" AS ENUM ('INITIAL', 'POST_CALL', 'POST_MEETING', 'EMAIL_RESPONSE');

-- CreateTable
CREATE TABLE "contact_engagement_log" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "entryType" "EngagementLogEntryType" NOT NULL DEFAULT 'INITIAL',
    "note" TEXT NOT NULL,
    "emailActivityId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_engagement_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_engagement_log_emailActivityId_key" ON "contact_engagement_log"("emailActivityId");

-- CreateIndex
CREATE INDEX "contact_engagement_log_contactId_loggedAt_idx" ON "contact_engagement_log"("contactId", "loggedAt");

-- AddForeignKey
ALTER TABLE "contact_engagement_log" ADD CONSTRAINT "contact_engagement_log_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
