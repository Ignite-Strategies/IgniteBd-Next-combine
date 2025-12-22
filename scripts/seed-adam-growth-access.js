/**
 * Seed Ignite Strategies CompanyHQ Growth Access
 * Run: node scripts/seed-adam-growth-access.js
 * 
 * Sets hasGrowthAccess = true for Ignite Strategies companyHQ
 * This allows Adam (and anyone in Ignite Strategies) to access full Growth features
 * while BusinessPoint Law (and other companies) get CRM-only access
 * 
 * Idempotent: Safe to run multiple times
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedIgniteStrategiesGrowthAccess() {
  try {
    console.log('🌱 Seeding Ignite Strategies CompanyHQ Growth Access...\n');

    // Find Ignite Strategies companyHQ
    const igniteHQ = await prisma.company_hqs.findFirst({
      where: {
        companyName: {
          contains: 'Ignite Strategies',
          mode: 'insensitive',
        }
      }
    });

    if (!igniteHQ) {
      console.log('❌ Ignite Strategies CompanyHQ not found');
      console.log('   Looking for companyName containing: Ignite Strategies');
      console.log('\n💡 Available CompanyHQs:');
      const allHQs = await prisma.company_hqs.findMany({
        select: { id: true, companyName: true },
        take: 10
      });
      allHQs.forEach(hq => {
        console.log(`   - ${hq.companyName} (${hq.id})`);
      });
      process.exit(1);
    }

    console.log(`✅ Found Ignite Strategies: ${igniteHQ.companyName} (${igniteHQ.id})`);
    console.log(`   Current hasGrowthAccess: ${igniteHQ.hasGrowthAccess ?? 'null (defaults to false)'}`);

    // Update hasGrowthAccess to true
    const updated = await prisma.company_hqs.update({
      where: { id: igniteHQ.id },
      data: { hasGrowthAccess: true }
    });

    console.log(`✅ Updated Ignite Strategies hasGrowthAccess to: ${updated.hasGrowthAccess}`);
    console.log('\n🎉 Done! Ignite Strategies now has Growth Access.');
    console.log('   - Adam in Ignite Strategies → Full Growth Dashboard');
    console.log('   - Adam in BusinessPoint Law → CRM Dashboard');
    console.log('   - Joel in BusinessPoint Law → CRM Dashboard');

  } catch (error) {
    console.error('❌ Error seeding Ignite Strategies growth access:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedIgniteStrategiesGrowthAccess();

