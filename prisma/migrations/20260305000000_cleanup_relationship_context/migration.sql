-- Drop noise columns from relationship_contexts
-- primaryWork, relationshipQuality, opportunityType were extracted by the AI
-- but produced inconsistent/hallucinated values (e.g. opportunityType = "speaking"
-- from "seemed interested in speaking"). The three enum dimensions
-- (contextOfRelationship, relationshipRecency, companyAwareness) + formerCompany
-- are the only fields we need.

ALTER TABLE "relationship_contexts" DROP COLUMN IF EXISTS "primaryWork";
ALTER TABLE "relationship_contexts" DROP COLUMN IF EXISTS "relationshipQuality";
ALTER TABLE "relationship_contexts" DROP COLUMN IF EXISTS "opportunityType";
