-- Add all SendGrid Inbound Parse fields (exact match, case-sensitive)
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "sender_ip" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "envelope" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "dkim" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "SPF" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "spam_score" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "spam_report" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "charsets" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "attachments" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "attachment_info" TEXT;
-- 'raw' already exists from previous migration, skip it
