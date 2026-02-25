-- CreateTable
CREATE TABLE "off_platform_email_sends" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "emailSent" TIMESTAMP(3) NOT NULL,
    "subject" TEXT,
    "platform" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "off_platform_email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "off_platform_email_sends_contactId_idx" ON "off_platform_email_sends"("contactId");

-- CreateIndex
CREATE INDEX "off_platform_email_sends_contactId_emailSent_idx" ON "off_platform_email_sends"("contactId", "emailSent");

-- CreateIndex
CREATE INDEX "off_platform_email_sends_emailSent_idx" ON "off_platform_email_sends"("emailSent");

-- AddForeignKey
ALTER TABLE "off_platform_email_sends" ADD CONSTRAINT "off_platform_email_sends_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
