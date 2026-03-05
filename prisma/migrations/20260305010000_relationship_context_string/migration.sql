-- Convert relationship_contexts enum columns to plain text.
-- Postgres casts enum → text natively, existing values are preserved as-is.
-- This removes the rigid enum constraint so any string can be stored,
-- letting the schema evolve without migrations every time we add a new context type.

ALTER TABLE "relationship_contexts"
  ALTER COLUMN "contextOfRelationship" TYPE TEXT,
  ALTER COLUMN "relationshipRecency"   TYPE TEXT,
  ALTER COLUMN "companyAwareness"      TYPE TEXT;

-- Drop the now-unused enum types
DROP TYPE IF EXISTS "ContextOfRelationship";
DROP TYPE IF EXISTS "RelationshipRecency";
DROP TYPE IF EXISTS "CompanyAwareness";

-- Also drop the composite index (was on enum columns; plain index on contactId is enough)
DROP INDEX IF EXISTS "relationship_contexts_contextOfRelationship_relationshipRecency_companyAwareness_idx";
