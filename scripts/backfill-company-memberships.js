import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * Backfills company_memberships for all existing CompanyHQs
 * Creates OWNER membership for each companyHQ.ownerId
 */
async function backfillMemberships() {
  console.log('🚀 Backfilling Company Memberships...\n');

  try {
    // 1. Get all CompanyHQs with an ownerId
    console.log('1️⃣ Finding CompanyHQs with owners...');
    const companyHQs = await prisma.company_hqs.findMany({
      where: {
        ownerId: { not: null }
      },
      select: {
        id: true,
        companyName: true,
        ownerId: true,
      }
    });

    console.log(`Found ${companyHQs.length} CompanyHQs with owners\n`);

    if (companyHQs.length === 0) {
      console.log('✅ No CompanyHQs to backfill');
      return;
    }

    // 2. For each CompanyHQ, ensure membership exists
    console.log('2️⃣ Creating/verifying memberships...');
    let created = 0;
    let existing = 0;

    for (const hq of companyHQs) {
      // Check if membership already exists
      const existingMembership = await prisma.company_memberships.findUnique({
        where: {
          userId_companyHqId: {
            userId: hq.ownerId,
            companyHqId: hq.id,
          }
        }
      });

      if (existingMembership) {
        console.log(`  ✓ Membership exists: ${hq.companyName} (${hq.ownerId})`);
        existing++;
      } else {
        // Create membership
        await prisma.company_memberships.create({
          data: {
            id: randomUUID(),
            userId: hq.ownerId,
            companyHqId: hq.id,
            role: 'OWNER', // OWNER role will be sorted first automatically
          }
        });
        console.log(`  ✅ Created: ${hq.companyName} (${hq.ownerId})`);
        created++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  Created: ${created}`);
    console.log(`  Already existed: ${existing}`);
    console.log(`  Total: ${companyHQs.length}`);

    // 3. Verify all CompanyHQs now have at least one OWNER
    console.log('\n3️⃣ Verifying all CompanyHQs have an OWNER...');
    const hqsWithoutOwner = await prisma.company_hqs.findMany({
      where: {
        company_memberships: {
          none: {
            role: 'OWNER'
          }
        }
      },
      select: {
        id: true,
        companyName: true,
      }
    });

    if (hqsWithoutOwner.length > 0) {
      console.log('⚠️  CompanyHQs without OWNER membership:');
      hqsWithoutOwner.forEach(hq => {
        console.log(`  - ${hq.companyName} (${hq.id})`);
      });
    } else {
      console.log('✅ All CompanyHQs have at least one OWNER membership');
    }

    console.log('\n🎉 Backfill completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Add resolveMembership() helper');
    console.log('   2. Add membership guards to routes');
    console.log('   3. Test that non-members are blocked');

  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backfillMemberships()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
