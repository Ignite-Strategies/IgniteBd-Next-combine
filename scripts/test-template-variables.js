/**
 * Test script to verify template_variables table and list companies
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('🔍 Testing template_variables table...\n');

    // Check if table exists by trying to count
    // Note: Prisma converts model names, so template_variables becomes template_variables
    const count = await prisma.template_variables.count();
    console.log(`✅ Table exists! Current variable count: ${count}\n`);

    // List first few companies
    const companies = await prisma.company_hqs.findMany({
      take: 5,
      select: {
        id: true,
        companyName: true,
      },
    });

    console.log(`📋 Found ${companies.length} companies (showing first 5):`);
    companies.forEach((company) => {
      console.log(`  - ${company.companyName || 'Unnamed'} (ID: ${company.id})`);
    });

    if (companies.length > 0) {
      console.log(`\n💡 To seed built-in variables, run:`);
      console.log(`   node scripts/seed-built-in-variables.js ${companies[0].id}`);
    }

    // Check existing variables
    if (count > 0) {
      const variables = await prisma.template_variables.findMany({
        take: 10,
        select: {
          variableKey: true,
          source: true,
          isBuiltIn: true,
          companyHQId: true,
        },
      });
      console.log(`\n📦 Existing variables:`);
      variables.forEach((v) => {
        console.log(`  - {{${v.variableKey}}} (${v.source}, built-in: ${v.isBuiltIn})`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2021') {
      console.error('   Table does not exist. Run migrations first.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

test();
