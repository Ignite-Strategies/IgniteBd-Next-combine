-- CreateTable
CREATE TABLE IF NOT EXISTS "deck_artifacts" (
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
CREATE INDEX IF NOT EXISTS "deck_artifacts_companyHQId_idx" ON "deck_artifacts"("companyHQId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deck_artifacts_status_idx" ON "deck_artifacts"("status");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'deck_artifacts_companyHQId_fkey'
    ) THEN
        ALTER TABLE "deck_artifacts" ADD CONSTRAINT "deck_artifacts_companyHQId_fkey" 
        FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

