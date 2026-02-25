-- AlterTable
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "sendgridVerifiedEmail" TEXT;
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "sendgridVerifiedName" TEXT;

