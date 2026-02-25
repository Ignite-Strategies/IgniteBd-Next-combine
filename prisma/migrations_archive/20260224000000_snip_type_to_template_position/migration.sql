-- CreateEnum
CREATE TYPE "TemplatePosition" AS ENUM ('SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE');

-- Add column and backfill from snipType
ALTER TABLE "content_snips" ADD COLUMN "templatePosition" "TemplatePosition";

UPDATE "content_snips" SET "templatePosition" = CASE "snipType"
  WHEN 'subject' THEN 'SUBJECT_LINE'::"TemplatePosition"
  WHEN 'opening' THEN 'OPENING_GREETING'::"TemplatePosition"
  WHEN 'service' THEN 'BUSINESS_CONTEXT'::"TemplatePosition"
  WHEN 'competitor' THEN 'COMPETITOR_FRAME'::"TemplatePosition"
  WHEN 'value' THEN 'VALUE_PROPOSITION'::"TemplatePosition"
  WHEN 'cta' THEN 'TARGET_ASK'::"TemplatePosition"
  WHEN 'relationship' THEN 'SOFT_CLOSE'::"TemplatePosition"
  WHEN 'intent' THEN 'OPENING_GREETING'::"TemplatePosition"
  ELSE 'SOFT_CLOSE'::"TemplatePosition"
END WHERE "snipType" IS NOT NULL;

-- Default any nulls (shouldn't exist after backfill)
UPDATE "content_snips" SET "templatePosition" = 'SOFT_CLOSE'::"TemplatePosition" WHERE "templatePosition" IS NULL;

ALTER TABLE "content_snips" ALTER COLUMN "templatePosition" SET NOT NULL;

-- Drop old column and index
DROP INDEX IF EXISTS "content_snips_companyHQId_snipType_idx";
ALTER TABLE "content_snips" DROP COLUMN "snipType";

-- CreateIndex
CREATE INDEX "content_snips_companyHQId_templatePosition_idx" ON "content_snips"("companyHQId", "templatePosition");
