-- CreateTable
CREATE TABLE "presentations" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slides" JSONB,
    "presenter" TEXT,
    "description" TEXT,
    "feedback" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    
    -- Gamma deck generation fields
    "gammaStatus" TEXT,
    "gammaDeckUrl" TEXT,
    "gammaPptxUrl" TEXT,
    "gammaBlob" TEXT,
    "gammaError" TEXT,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presentations_companyHQId_idx" ON "presentations"("companyHQId");

-- CreateIndex
CREATE INDEX "presentations_published_idx" ON "presentations"("published");

-- CreateIndex
CREATE INDEX "presentations_gammaStatus_idx" ON "presentations"("gammaStatus");

-- AddForeignKey
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
