-- CreateEnum
CREATE TYPE "ContextOfRelationship" AS ENUM ('DONT_KNOW', 'PRIOR_CONVERSATION', 'PRIOR_COLLEAGUE', 'PRIOR_SCHOOLMATE', 'CURRENT_CLIENT', 'CONNECTED_LINKEDIN_ONLY', 'REFERRAL', 'REFERRAL_FROM_WARM_CONTACT', 'USED_TO_WORK_AT_TARGET_COMPANY');

-- CreateEnum
CREATE TYPE "RelationshipRecency" AS ENUM ('NEW', 'RECENT', 'STALE', 'LONG_DORMANT');

-- CreateEnum
CREATE TYPE "CompanyAwareness" AS ENUM ('NO_CLUE', 'KNOWS_COMPANY', 'KNOWS_COMPANY_COMPETITOR', 'KNOWS_BUT_DISENGAGED');

-- CreateTable
CREATE TABLE "relationship_contexts" (
    "relationshipContextId" TEXT NOT NULL,
    "contextOfRelationship" "ContextOfRelationship" NOT NULL,
    "relationshipRecency" "RelationshipRecency" NOT NULL,
    "companyAwareness" "CompanyAwareness" NOT NULL,
    "contextKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_contexts_pkey" PRIMARY KEY ("relationshipContextId")
);

-- CreateIndex
CREATE UNIQUE INDEX "relationship_contexts_contextKey_key" ON "relationship_contexts"("contextKey");

-- CreateIndex
CREATE INDEX "relationship_contexts_contextKey_idx" ON "relationship_contexts"("contextKey");

-- CreateIndex
CREATE INDEX "relationship_contexts_contextOfRelationship_relationshipRecency_companyAwareness_idx" ON "relationship_contexts"("contextOfRelationship", "relationshipRecency", "companyAwareness");

-- AlterTable: Remove old fields, add new field
ALTER TABLE "content_snips" 
  DROP COLUMN IF EXISTS "contextType",
  DROP COLUMN IF EXISTS "intentType",
  ADD COLUMN IF NOT EXISTS "relationshipContextId" TEXT;

-- CreateIndex
CREATE INDEX "content_snips_relationshipContextId_idx" ON "content_snips"("relationshipContextId");

-- AddForeignKey
ALTER TABLE "content_snips" ADD CONSTRAINT "content_snips_relationshipContextId_fkey" FOREIGN KEY ("relationshipContextId") REFERENCES "relationship_contexts"("relationshipContextId") ON DELETE SET NULL ON UPDATE CASCADE;
