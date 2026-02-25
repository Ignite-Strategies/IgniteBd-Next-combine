-- CreateTable
CREATE TABLE "template_variables" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "variableKey" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "dbField" TEXT,
    "computedRule" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_variables_companyHQId_variableKey_key" ON "template_variables"("companyHQId", "variableKey");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_idx" ON "template_variables"("companyHQId");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_source_idx" ON "template_variables"("companyHQId", "source");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_isActive_idx" ON "template_variables"("companyHQId", "isActive");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_isBuiltIn_idx" ON "template_variables"("companyHQId", "isBuiltIn");

-- AddForeignKey
ALTER TABLE "template_variables" ADD CONSTRAINT "template_variables_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
