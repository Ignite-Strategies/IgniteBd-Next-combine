-- CreateTable
CREATE TABLE "RawMeetingNotes" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT,
    "from" TEXT,
    "to" TEXT,
    "subject" TEXT,
    "text" TEXT,
    "html" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawMeetingNotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawMeetingNotes_companyHQId_idx" ON "RawMeetingNotes"("companyHQId");

-- CreateIndex
CREATE INDEX "RawMeetingNotes_status_idx" ON "RawMeetingNotes"("status");

-- AddForeignKey
ALTER TABLE "RawMeetingNotes" ADD CONSTRAINT "RawMeetingNotes_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
