-- CreateTable
CREATE TABLE "template_snippets" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_snippets_companyHQId_variableName_key" ON "template_snippets"("companyHQId", "variableName");

-- CreateIndex
CREATE INDEX "template_snippets_companyHQId_idx" ON "template_snippets"("companyHQId");

-- AddForeignKey
ALTER TABLE "template_snippets" ADD CONSTRAINT "template_snippets_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
