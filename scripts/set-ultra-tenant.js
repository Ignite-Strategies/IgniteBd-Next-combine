/**
 * Set Ultra Tenant
 * 
 * Sets Ignite Strategies (cmhmdw78k0001mb1vioxdw2g8) as the root ultra tenant
 * Ensures its ultraTenantId is null (it's the root)
 * 
 * Run: node scripts/set-ultra-tenant.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ULTRA_TENANT_ID = 'cmhmdw78k0001mb1vioxdw2g8'; // Ignite Strategies

async function main() {
  try {
    // Find the ultra tenant
    const root = await prisma.companyHQ.findUnique({
      where: { id: ULTRA_TENANT_ID },
    });

    if (!root) {
      console.error('❌ Ultra tenant not found!');
      console.error(`   Looking for ID: ${ULTRA_TENANT_ID}`);
      process.exit(1);
    }

    console.log('✅ Ultra tenant confirmed:', {
      id: root.id,
      companyName: root.companyName,
      currentUltraTenantId: root.ultraTenantId,
    });

    // Make sure ultra tenant's own parent is null (it's the root)
    const updated = await prisma.companyHQ.update({
      where: { id: ULTRA_TENANT_ID },
      data: { ultraTenantId: null },
    });

    console.log('✅ Ultra tenant updated as root:', {
      id: updated.id,
      companyName: updated.companyName,
      ultraTenantId: updated.ultraTenantId, // Should be null
    });

    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Error setting ultra tenant:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

