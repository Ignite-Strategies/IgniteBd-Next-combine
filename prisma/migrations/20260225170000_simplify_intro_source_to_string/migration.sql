-- Simplify intro source: drop FK/relation, use a plain string (contact id) so we can say "introduced by this contact" and look up when needed.
-- Also drop introPositionInTarget (schema sprawl rollback).

-- Drop FK then index then column (intro source)
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_introSourceContactId_fkey";
DROP INDEX IF EXISTS "contacts_introSourceContactId_idx";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "introSourceContactId";

-- Add simple optional string: the other contact's id
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "introducedByContactId" TEXT;

-- Drop introPositionInTarget (enum column + index + type)
DROP INDEX IF EXISTS "contacts_introPositionInTarget_idx";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "introPositionInTarget";
DROP TYPE IF EXISTS "IntroPositionInTarget";
