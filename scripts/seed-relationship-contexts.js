/**
 * Seed relationship contexts
 * Creates all combinations of ContextOfRelationship × RelationshipRecency × CompanyAwareness
 * Usage: node scripts/seed-relationship-contexts.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONTEXT_OF_RELATIONSHIP = [
  'DONT_KNOW',
  'PRIOR_CONVERSATION',
  'PRIOR_COLLEAGUE',
  'PRIOR_SCHOOLMATE',
  'CURRENT_CLIENT',
  'CONNECTED_LINKEDIN_ONLY',
  'REFERRAL',
  'REFERRAL_FROM_WARM_CONTACT',
  'USED_TO_WORK_AT_TARGET_COMPANY',
];

const RELATIONSHIP_RECENCY = ['NEW', 'RECENT', 'STALE', 'LONG_DORMANT'];

const COMPANY_AWARENESS = [
  'DONT_KNOW',
  'KNOWS_COMPANY',
  'KNOWS_COMPANY_COMPETITOR',
  'KNOWS_BUT_DISENGAGED',
];

function generateContextKey(contextOfRelationship, relationshipRecency, companyAwareness) {
  return `${contextOfRelationship}_${relationshipRecency}_${companyAwareness}`;
}

async function seedRelationshipContexts() {
  console.log('🌱 Seeding relationship contexts...\n');

  let created = 0;
  let skipped = 0;

  for (const contextOfRelationship of CONTEXT_OF_RELATIONSHIP) {
    for (const relationshipRecency of RELATIONSHIP_RECENCY) {
      for (const companyAwareness of COMPANY_AWARENESS) {
        const contextKey = generateContextKey(
          contextOfRelationship,
          relationshipRecency,
          companyAwareness,
        );

        try {
          const result = await prisma.relationship_contexts.upsert({
            where: { contextKey },
            update: {
              contextOfRelationship,
              relationshipRecency,
              companyAwareness,
            },
            create: {
              contextOfRelationship,
              relationshipRecency,
              companyAwareness,
              contextKey,
            },
          });

          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            created++;
            console.log(`  ✅ Created: ${contextKey}`);
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`  ❌ Error with ${contextKey}:`, error.message);
        }
      }
    }
  }

  const total = CONTEXT_OF_RELATIONSHIP.length * RELATIONSHIP_RECENCY.length * COMPANY_AWARENESS.length;
  console.log(`\n✅ Complete! Created: ${created}, Updated/Skipped: ${skipped}, Total: ${total}`);
}

seedRelationshipContexts()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
