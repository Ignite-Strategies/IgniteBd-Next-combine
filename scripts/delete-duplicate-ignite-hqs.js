/**
 * Delete Duplicate Ignite Strategies CompanyHQs
 * 
 * Finds all CompanyHQs with "Ignite Strategies" in the name
 * Keeps the one with ultraTenantId = null (root tenant) or the oldest one
 * Deletes the rest
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IGNITEBD_COMPANY_NAME = 'Ignite Strategies';

async function main() {
  console.log('🔍 Finding duplicate Ignite Strategies CompanyHQs...\n');

  try {
    // Find all CompanyHQs with "Ignite Strategies" in the name
    const igniteHQs = await prisma.companyHQ.findMany({
      where: {
        companyName: {
          contains: IGNITEBD_COMPANY_NAME,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
    });

    console.log(`Found ${igniteHQs.length} CompanyHQs matching "Ignite Strategies":\n`);

    if (igniteHQs.length === 0) {
      console.log('✅ No duplicates found');
      return;
    }

    // Display all found
    igniteHQs.forEach((hq, index) => {
      console.log(`${index + 1}. ID: ${hq.id}`);
      console.log(`   Name: ${hq.companyName}`);
      console.log(`   Created: ${hq.createdAt}`);
      console.log(`   Ultra Tenant ID: ${hq.ultraTenantId || 'null (root)'}`);
      console.log(`   Owner ID: ${hq.ownerId || 'null'}`);
      console.log('');
    });

    // Determine which one to keep
    // Priority: 1) ultraTenantId = null (root tenant), 2) oldest
    const rootTenant = igniteHQs.find((hq) => hq.ultraTenantId === null);
    const keepHQ = rootTenant || igniteHQs[0]; // Keep root tenant or oldest

    console.log(`\n✅ Keeping CompanyHQ: ${keepHQ.id} (${keepHQ.ultraTenantId === null ? 'root tenant' : 'oldest'})`);

    // Delete the rest
    const toDelete = igniteHQs.filter((hq) => hq.id !== keepHQ.id);

    if (toDelete.length === 0) {
      console.log('✅ No duplicates to delete');
      return;
    }

    console.log(`\n🗑️  Deleting ${toDelete.length} duplicate(s):\n`);

    for (const hq of toDelete) {
      try {
        // First, update any CompanyHQs that reference this as ultraTenant
        await prisma.companyHQ.updateMany({
          where: { ultraTenantId: hq.id },
          data: { ultraTenantId: keepHQ.id },
        });

        // Then delete the duplicate
        await prisma.companyHQ.delete({
          where: { id: hq.id },
        });

        console.log(`   ✅ Deleted: ${hq.id} (${hq.companyName})`);
      } catch (err) {
        console.error(`   ❌ Error deleting ${hq.id}:`, err.message);
      }
    }

    console.log('\n🎉 Cleanup complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Kept: ${keepHQ.id}`);
    console.log(`   - Deleted: ${toDelete.length} duplicate(s)`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
