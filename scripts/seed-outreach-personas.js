/**
 * Seed simple outreach personas
 * These are descriptive slugs that drive snippet assembly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const personas = [
  {
    slug: 'FormerColleagueNowReachingoutAgainAfterLongTime',
    name: 'Former Colleague - Long Time',
    description: 'Someone you worked with before, reaching out again after a long time',
  },
  {
    slug: 'NewContactAtTargetCompany',
    name: 'New Contact - Target Company',
    description: 'First time reaching out to someone at a target company',
  },
  {
    slug: 'WarmIntroductionFromMutualConnection',
    name: 'Warm Introduction',
    description: 'Introduced by a mutual connection',
  },
  {
    slug: 'PriorConversationNeverFollowedUp',
    name: 'Prior Conversation - No Follow-up',
    description: 'Had a conversation before but never followed up',
  },
  {
    slug: 'CompetitorSwitchingProspect',
    name: 'Competitor Switching Prospect',
    description: 'Currently using a competitor, exploring alternatives',
  },
  {
    slug: 'ColdOutreachToDecisionMaker',
    name: 'Cold Outreach - Decision Maker',
    description: 'Cold outreach to a decision maker at target company',
  },
  {
    slug: 'ReactivationAfterStaleRelationship',
    name: 'Reactivation - Stale Relationship',
    description: 'Reconnecting after relationship went stale',
  },
  {
    slug: 'SeasonalReconnection',
    name: 'Seasonal Reconnection',
    description: 'Reaching out during a specific season/holiday',
  },
];

async function main() {
  console.log('🌱 Seeding outreach personas...');

  for (const persona of personas) {
    await prisma.outreach_personas.upsert({
      where: { slug: persona.slug },
      update: {
        name: persona.name,
        description: persona.description,
      },
      create: persona,
    });
    console.log(`✅ ${persona.slug}`);
  }

  console.log(`\n✨ Seeded ${personas.length} outreach personas`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
