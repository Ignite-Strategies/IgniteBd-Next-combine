/**
 * Seed SuperAdmin and Ultra Tenant Setup
 * 
 * This script:
 * 1. Creates SuperAdmin for a specific owner (by Firebase ID)
 * 2. Finds or creates IgniteBD master CompanyHQ
 * 3. Sets IgniteBD as root ultra tenant (ultraTenantId = null)
 * 4. Sets all other CompanyHQs to have IgniteBD as their ultraTenantId
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Your Firebase UID from the console logs
const YOUR_FIREBASE_ID = 'gupQlyuipEY40oHtDANT6tvxYHi2';
const IGNITEBD_COMPANY_NAME = 'Ignite Strategies';

async function main() {
  console.log('🚀 Starting SuperAdmin and Ultra Tenant seeding...\n');

  try {
    // Step 1: Find your owner by Firebase ID
    console.log('📋 Step 1: Finding owner by Firebase ID...');
    let owner = await prisma.owner.findUnique({
      where: { firebaseId: YOUR_FIREBASE_ID },
    });

    if (!owner) {
      console.error(`❌ Owner not found with Firebase ID: ${YOUR_FIREBASE_ID}`);
      console.log('💡 Make sure you\'re logged in and the Firebase ID is correct.');
      process.exit(1);
    }

    console.log(`✅ Found owner: ${owner.name || owner.email} (${owner.id})\n`);

    // Step 2: Create or update SuperAdmin
    console.log('📋 Step 2: Setting up SuperAdmin...');
    // Note: Prisma client uses camelCase, so SuperAdmin model becomes superAdmin
    let superAdmin = await prisma.superAdmin.findUnique({
      where: { ownerId: owner.id },
    }).catch(() => null);

    if (superAdmin) {
      console.log(`✅ SuperAdmin already exists for owner ${owner.id}`);
      if (!superAdmin.active) {
        superAdmin = await prisma.superAdmin.update({
          where: { ownerId: owner.id },
          data: { active: true },
        });
        console.log('✅ Activated SuperAdmin');
      }
    } else {
      try {
        superAdmin = await prisma.superAdmin.create({
          data: {
            ownerId: owner.id,
            active: true,
          },
        });
        console.log(`✅ Created SuperAdmin: ${superAdmin.id}\n`);
      } catch (err) {
        console.error('Error creating SuperAdmin:', err.message);
        // Try alternative approach - check if model exists
        const models = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
        console.log('Available Prisma models:', models.join(', '));
        throw err;
      }
    }

    // Step 3: Find or create IgniteBD master CompanyHQ
    console.log('📋 Step 3: Finding or creating IgniteBD master CompanyHQ...');
    let igniteBDHQ = await prisma.companyHQ.findFirst({
      where: {
        companyName: {
          contains: IGNITEBD_COMPANY_NAME,
          mode: 'insensitive',
        },
      },
    });

    if (!igniteBDHQ) {
      // Create IgniteBD as master HQ
      igniteBDHQ = await prisma.companyHQ.create({
        data: {
          companyName: IGNITEBD_COMPANY_NAME,
          whatYouDo: 'Business acquisition services for professional service solo founders.',
          companyStreet: '2604 N. George Mason Dr.',
          companyCity: 'Arlington',
          companyState: 'VA',
          companyWebsite: 'https://www.ignitestrategies.co',
          ownerId: owner.id, // You own IgniteBD
          ultraTenantId: null, // Root tenant (no parent)
        },
      });
      console.log(`✅ Created IgniteBD master CompanyHQ: ${igniteBDHQ.id}`);
    } else {
      // Update to ensure it's the root tenant
      if (igniteBDHQ.ultraTenantId !== null) {
        igniteBDHQ = await prisma.companyHQ.update({
          where: { id: igniteBDHQ.id },
          data: { ultraTenantId: null },
        });
        console.log(`✅ Updated IgniteBD to be root tenant (ultraTenantId = null)`);
      } else {
        console.log(`✅ IgniteBD already set as root tenant: ${igniteBDHQ.id}`);
      }
    }

    console.log(`   CompanyHQ ID: ${igniteBDHQ.id}`);
    console.log(`   Company Name: ${igniteBDHQ.companyName}\n`);

    // Step 4: Set all other CompanyHQs to have IgniteBD as parent
    console.log('📋 Step 4: Setting other CompanyHQs to have IgniteBD as ultra tenant...');
    const otherHQs = await prisma.companyHQ.findMany({
      where: {
        id: { not: igniteBDHQ.id },
        ultraTenantId: { not: igniteBDHQ.id },
      },
    });

    if (otherHQs.length > 0) {
      const updateResult = await prisma.companyHQ.updateMany({
        where: {
          id: { not: igniteBDHQ.id },
          ultraTenantId: { not: igniteBDHQ.id },
        },
        data: {
          ultraTenantId: igniteBDHQ.id,
        },
      });
      console.log(`✅ Updated ${updateResult.count} CompanyHQs to have IgniteBD as parent`);
    } else {
      console.log('✅ All CompanyHQs already have IgniteBD as parent (or no other HQs exist)');
    }

    console.log('\n🎉 Seeding complete!');
    console.log('\n📊 Summary:');
    console.log(`   - SuperAdmin: ${superAdmin.active ? '✅ Active' : '❌ Inactive'}`);
    console.log(`   - IgniteBD CompanyHQ: ${igniteBDHQ.id} (root tenant)`);
    console.log(`   - Sub-tenants: ${otherHQs.length} CompanyHQs linked to IgniteBD`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
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
