-- CreateEnum
CREATE TYPE "EmailSource" AS ENUM ('PLATFORM', 'OFF_PLATFORM');

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sendDate" TIMESTAMP(3) NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "source" "EmailSource" NOT NULL,
    "platform" TEXT,
    "contactResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "responseSubject" TEXT,
    "hasResponded" BOOLEAN NOT NULL DEFAULT false,
    "emailActivityId" TEXT,
    "offPlatformSendId" TEXT,
    "messageId" TEXT,
    "campaignId" TEXT,
    "sequenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emails_emailActivityId_key" ON "emails"("emailActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_offPlatformSendId_key" ON "emails"("offPlatformSendId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_key" ON "emails"("messageId");

-- CreateIndex
CREATE INDEX "emails_contactId_idx" ON "emails"("contactId");

-- CreateIndex
CREATE INDEX "emails_contactId_sendDate_idx" ON "emails"("contactId", "sendDate");

-- CreateIndex
CREATE INDEX "emails_sendDate_idx" ON "emails"("sendDate");

-- CreateIndex
CREATE INDEX "emails_hasResponded_idx" ON "emails"("hasResponded");

-- CreateIndex
CREATE INDEX "emails_source_idx" ON "emails"("source");

-- CreateIndex
CREATE INDEX "emails_messageId_idx" ON "emails"("messageId");

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_emailActivityId_fkey" FOREIGN KEY ("emailActivityId") REFERENCES "email_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_offPlatformSendId_fkey" FOREIGN KEY ("offPlatformSendId") REFERENCES "off_platform_email_sends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
