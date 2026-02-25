-- Revert UUID defaults back to Prisma cuid() pattern (client-side generation)
-- This avoids database-level defaults that cause schema drift
-- Prisma will generate IDs client-side using cuid()

-- Remove database defaults (Prisma will handle ID generation)
ALTER TABLE "contacts" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "templates" ALTER COLUMN "id" DROP DEFAULT;
