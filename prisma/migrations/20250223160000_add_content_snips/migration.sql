-- CreateTable
CREATE TABLE "content_snips" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "snipName" TEXT NOT NULL,
    "snipText" TEXT NOT NULL,
    "snipType" TEXT NOT NULL,
    "contextType" TEXT,
    "intentType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_snips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_snips_companyHQId_snipName_key" ON "content_snips"("companyHQId", "snipName");

-- CreateIndex
CREATE INDEX "content_snips_companyHQId_idx" ON "content_snips"("companyHQId");

-- CreateIndex
CREATE INDEX "content_snips_companyHQId_snipType_idx" ON "content_snips"("companyHQId", "snipType");

-- CreateIndex
CREATE INDEX "content_snips_companyHQId_isActive_idx" ON "content_snips"("companyHQId", "isActive");

-- AddForeignKey
ALTER TABLE "content_snips" ADD CONSTRAINT "content_snips_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
