-- AlterTable: add optional intentType to template_snippets
ALTER TABLE "template_snippets" ADD COLUMN IF NOT EXISTS "intentType" TEXT;
