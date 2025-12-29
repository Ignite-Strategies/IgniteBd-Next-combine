-- Create email_signatures table (simplified - owner-level only)
-- Signatures are appended to body during payload building, not stored on campaigns/sequences
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

-- Remove emailSignature from owners (if it exists from previous migration attempt)
ALTER TABLE "owners" DROP COLUMN IF EXISTS "emailSignature";

-- Create indexes
CREATE INDEX IF NOT EXISTS "email_signatures_owner_id_idx" ON "email_signatures"("owner_id");
CREATE INDEX IF NOT EXISTS "email_signatures_owner_id_is_default_idx" ON "email_signatures"("owner_id", "is_default");

-- Add foreign key constraint
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
