/**
 * Seed built-in template variables
 * Run this script to populate the database with standard variables
 * Usage: node scripts/seed-built-in-variables.js [companyHQId]
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BUILT_IN_VARIABLES = [
  {
    variableKey: 'firstName',
    description: "Contact's first name",
    source: 'CONTACT',
    dbField: 'firstName',
    isBuiltIn: true,
  },
  {
    variableKey: 'lastName',
    description: "Contact's last name",
    source: 'CONTACT',
    dbField: 'lastName',
    isBuiltIn: true,
  },
  {
    variableKey: 'fullName',
    description: "Contact's full name",
    source: 'CONTACT',
    dbField: 'fullName',
    isBuiltIn: true,
  },
  {
    variableKey: 'goesBy',
    description: "Name contact prefers to be called",
    source: 'CONTACT',
    dbField: 'goesBy',
    isBuiltIn: true,
  },
  {
    variableKey: 'companyName',
    description: "Contact's current company name",
    source: 'CONTACT',
    dbField: 'companyName',
    isBuiltIn: true,
  },
  {
    variableKey: 'title',
    description: "Contact's job title",
    source: 'CONTACT',
    dbField: 'title',
    isBuiltIn: true,
  },
  {
    variableKey: 'email',
    description: "Contact's email address",
    source: 'CONTACT',
    dbField: 'email',
    isBuiltIn: true,
  },
  {
    variableKey: 'timeSinceConnected',
    description: "How long since you last connected",
    source: 'COMPUTED',
    computedRule: 'Calculate time since last contact',
    isBuiltIn: true,
  },
];

async function seedBuiltInVariables(companyHQId) {
  if (!companyHQId) {
    console.error('❌ Error: companyHQId is required');
    console.log('Usage: node scripts/seed-built-in-variables.js <companyHQId>');
    process.exit(1);
  }

  // Verify company exists
  const company = await prisma.company_hqs.findUnique({
    where: { id: companyHQId },
  });

  if (!company) {
    console.error(`❌ Error: Company with ID ${companyHQId} not found`);
    process.exit(1);
  }

  console.log(`📦 Seeding built-in variables for company: ${company.name || companyHQId}`);

  let created = 0;
  let updated = 0;

  for (const variable of BUILT_IN_VARIABLES) {
    try {
      const result = await prisma.template_variables.upsert({
        where: {
          companyHQId_variableKey: {
            companyHQId,
            variableKey: variable.variableKey,
          },
        },
        update: {
          description: variable.description,
          source: variable.source,
          dbField: variable.dbField || null,
          computedRule: variable.computedRule || null,
          isBuiltIn: true,
          isActive: true,
        },
        create: {
          companyHQId,
          variableKey: variable.variableKey,
          description: variable.description,
          source: variable.source,
          dbField: variable.dbField || null,
          computedRule: variable.computedRule || null,
          isBuiltIn: true,
          isActive: true,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
        console.log(`  ✅ Created: ${variable.variableKey}`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${variable.variableKey}`);
      }
    } catch (error) {
      console.error(`  ❌ Error with ${variable.variableKey}:`, error.message);
    }
  }

  console.log(`\n✅ Complete! Created: ${created}, Updated: ${updated}`);
}

const companyHQId = process.argv[2];
seedBuiltInVariables(companyHQId)
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
