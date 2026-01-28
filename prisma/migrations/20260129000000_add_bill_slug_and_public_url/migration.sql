-- Add slug and publicBillUrl to bills_to_companies for public bill page URLs
ALTER TABLE "bills_to_companies" ADD COLUMN "slug" TEXT;
ALTER TABLE "bills_to_companies" ADD COLUMN "publicBillUrl" TEXT;

CREATE UNIQUE INDEX "bills_to_companies_slug_key" ON "bills_to_companies"("slug") WHERE "slug" IS NOT NULL;
CREATE INDEX "bills_to_companies_slug_idx" ON "bills_to_companies"("slug");
