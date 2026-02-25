-- CreateTable
CREATE TABLE "deck_artifacts" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "outlineJson" JSONB NOT NULL,
    "blobText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deck_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deck_artifacts_companyHQId_idx" ON "deck_artifacts"("companyHQId");

-- CreateIndex
CREATE INDEX "deck_artifacts_status_idx" ON "deck_artifacts"("status");

-- AddForeignKey
ALTER TABLE "deck_artifacts" ADD CONSTRAINT "deck_artifacts_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

