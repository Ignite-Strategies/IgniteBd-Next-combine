-- Allow inboundType to be null so legacy rows (pre-enum or un-migrated) hydrate in the list API.
-- Backfill existing nulls to OUTREACH so they appear in Outreach updates.
ALTER TABLE "InboundEmail" ALTER COLUMN "inboundType" DROP NOT NULL;
ALTER TABLE "InboundEmail" ALTER COLUMN "inboundType" DROP DEFAULT;
UPDATE "InboundEmail" SET "inboundType" = 'OUTREACH' WHERE "inboundType" IS NULL;
