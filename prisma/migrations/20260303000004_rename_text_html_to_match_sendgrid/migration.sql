-- Rename columns to match SendGrid field names exactly
ALTER TABLE "InboundEmail" RENAME COLUMN "textBody" TO "text";
ALTER TABLE "InboundEmail" RENAME COLUMN "htmlBody" TO "html";

-- Add 'email' field for SendGrid raw MIME (when "Send Raw" enabled)
ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "email" TEXT;
