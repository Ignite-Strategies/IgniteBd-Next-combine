/**
 * Set Default Product Tiers
 * 
 * Sets default 'foundation' tier for all existing owners who don't have a tier set.
 * Run this after adding the tier field to the schema.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setDefaultTiers() {
  try {
    console.log('🚀 Setting default tiers for owners...');

    // Update all owners without a tier to 'foundation'
    const result = await prisma.owners.updateMany({
      where: {
        OR: [
          { tier: null },
          { tier: '' },
        ],
      },
      data: {
        tier: 'foundation',
      },
    });

    console.log(`✅ Updated ${result.count} owner(s) to 'foundation' tier`);

    // Show summary
    const tierCounts = await prisma.owners.groupBy({
      by: ['tier'],
      _count: {
        tier: true,
      },
    });

    console.log('\n📊 Tier Distribution:');
    tierCounts.forEach(({ tier, _count }) => {
      console.log(`  ${tier || 'null'}: ${_count.tier}`);
    });

    console.log('\n✅ Default tier assignment complete!');
  } catch (error) {
    console.error('❌ Error setting default tiers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  setDefaultTiers()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { setDefaultTiers };

