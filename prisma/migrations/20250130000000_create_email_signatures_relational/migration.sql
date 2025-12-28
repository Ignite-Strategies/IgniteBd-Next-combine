-- Create email_signatures table
CREATE TABLE IF NOT EXISTS "email_signatures" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id")
);

-- Add signature_id to campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "signature_id" TEXT;

-- Add signature_id to sequence_steps
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "signature_id" TEXT;

-- Remove emailSignature from owners (if it exists from previous migration attempt)
ALTER TABLE "owners" DROP COLUMN IF EXISTS "emailSignature";

-- Create indexes
CREATE INDEX IF NOT EXISTS "email_signatures_owner_id_idx" ON "email_signatures"("owner_id");
CREATE INDEX IF NOT EXISTS "email_signatures_owner_id_is_default_idx" ON "email_signatures"("owner_id", "is_default");
CREATE INDEX IF NOT EXISTS "campaigns_signature_id_idx" ON "campaigns"("signature_id");
CREATE INDEX IF NOT EXISTS "sequence_steps_signature_id_idx" ON "sequence_steps"("signature_id");

-- Add foreign key constraints
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "email_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "email_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

