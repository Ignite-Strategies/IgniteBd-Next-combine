import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Known from audit
const PLATFORM_ID = 'platform-ignitebd-001';
const ADAM_OWNER_ID = 'cmj07e84g0000l404ud7g48a3';
const ADAM_SUPERADMIN_ID = 'cmj2pif2g0001nwyxwmrf7x28';

async function upsertData() {
  console.log('🚀 Upserting Platform and SuperAdmin...\n');

  try {
    // 1. Upsert Platform
    console.log('1️⃣ Upserting IgnitePlatform...');
    const platform = await prisma.platform.upsert({
      where: { id: PLATFORM_ID },
      update: {
        name: 'IgnitePlatform',
        updatedAt: new Date(),
      },
      create: {
        id: PLATFORM_ID,
        name: 'IgnitePlatform',
      },
    });
    console.log('✅ Platform upserted:', {
      id: platform.id,
      name: platform.name,
    });
    console.log('');

    // 2. Upsert SuperAdmin for Adam Cole
    console.log('2️⃣ Upserting SuperAdmin for Adam Cole...');
    const superAdmin = await prisma.super_admins.upsert({
      where: { id: ADAM_SUPERADMIN_ID },
      update: {
        ownerId: ADAM_OWNER_ID,
        platformId: PLATFORM_ID,
        updatedAt: new Date(),
      },
      create: {
        id: ADAM_SUPERADMIN_ID,
        ownerId: ADAM_OWNER_ID,
        platformId: PLATFORM_ID,
        updatedAt: new Date(),
      },
      include: {
        owners: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        platform: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    console.log('✅ SuperAdmin upserted:', {
      id: superAdmin.id,
      owner: `${superAdmin.owners.firstName} ${superAdmin.owners.lastName} (${superAdmin.owners.email})`,
      ownerId: superAdmin.ownerId,
      platform: superAdmin.platform.name,
      platformId: superAdmin.platformId,
    });
    console.log('');

    // 3. Verify the relationships
    console.log('3️⃣ Verifying relationships...');
    
    const platformWithRelations = await prisma.platform.findUnique({
      where: { id: PLATFORM_ID },
      include: {
        company_hqs: {
          select: { id: true, companyName: true }
        },
        super_admins: {
          include: {
            owners: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });

    console.log('\n📊 Platform Structure:');
    console.log(`Platform: ${platformWithRelations.name}`);
    console.log(`  CompanyHQs: ${platformWithRelations.company_hqs.length}`);
    platformWithRelations.company_hqs.forEach(hq => {
      console.log(`    - ${hq.companyName} (${hq.id})`);
    });
    console.log(`  SuperAdmins: ${platformWithRelations.super_admins.length}`);
    platformWithRelations.super_admins.forEach(admin => {
      console.log(`    - ${admin.owners.firstName} ${admin.owners.lastName} (${admin.owners.email})`);
    });

    console.log('\n🎉 Upsert completed successfully!');

  } catch (error) {
    console.error('\n❌ Upsert failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

upsertData()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
