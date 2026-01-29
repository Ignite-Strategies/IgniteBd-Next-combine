/**
 * Add companyZip column to company_hqs table
 * Run: node scripts/add-company-zip-column.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addCompanyZipColumn() {
  try {
    console.log('🌱 Adding companyZip column to company_hqs table...\n');

    // Add column using raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "company_hqs" 
      ADD COLUMN IF NOT EXISTS "companyZip" TEXT;
    `);

    console.log('✅ Added companyZip column');

    // Update Ignite Strategies with zip code
    const igniteCompanies = await prisma.company_hqs.findMany({
      where: {
        companyName: {
          contains: 'Ignite',
          mode: 'insensitive',
        },
      },
    });

    for (const company of igniteCompanies) {
      if (company.companyStreet && !company.companyZip) {
        console.log(`\n📝 Updating ${company.companyName} with zip code...`);
        await prisma.company_hqs.update({
          where: { id: company.id },
          data: {
            companyZip: '22207',
          },
        });
        console.log(`  ✅ Added zip code: 22207`);
      }
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addCompanyZipColumn();
