/**
 * Migration Script: Move Microsoft data from owners to MicrosoftAccount model
 * 
 * This script migrates existing Microsoft OAuth data from the owners table
 * to the new MicrosoftAccount model.
 * 
 * Run: node scripts/migrate-microsoft-to-account.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateMicrosoftData() {
  console.log('🚀 Starting Microsoft data migration...\n');

  try {
    // Find all owners with Microsoft tokens
    const ownersWithMicrosoft = await prisma.owners.findMany({
      where: {
        AND: [
          { microsoftAccessToken: { not: null } },
          { microsoftRefreshToken: { not: null } },
        ],
      },
      select: {
        id: true,
        microsoftAccessToken: true,
        microsoftRefreshToken: true,
        microsoftExpiresAt: true,
        microsoftEmail: true,
        microsoftDisplayName: true,
        microsoftTenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`📊 Found ${ownersWithMicrosoft.length} owners with Microsoft tokens\n`);

    if (ownersWithMicrosoft.length === 0) {
      console.log('✅ No data to migrate. Exiting.');
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const owner of ownersWithMicrosoft) {
      try {
        // Check if MicrosoftAccount already exists for this owner
        const existing = await prisma.microsoftAccount.findUnique({
          where: { ownerId: owner.id },
        });

        if (existing) {
          console.log(`⏭️  Skipping owner ${owner.id} - MicrosoftAccount already exists`);
          skipped++;
          continue;
        }

        // Validate required fields
        if (!owner.microsoftEmail) {
          console.log(`⚠️  Skipping owner ${owner.id} - missing microsoftEmail`);
          skipped++;
          continue;
        }

        // Create MicrosoftAccount record
        await prisma.microsoftAccount.create({
          data: {
            ownerId: owner.id,
            microsoftEmail: owner.microsoftEmail,
            microsoftDisplayName: owner.microsoftDisplayName || null,
            microsoftTenantId: owner.microsoftTenantId || null,
            accessToken: owner.microsoftAccessToken,
            refreshToken: owner.microsoftRefreshToken,
            expiresAt: owner.microsoftExpiresAt || null,
            connectedAt: owner.createdAt || new Date(),
            createdAt: owner.createdAt || new Date(),
            updatedAt: owner.updatedAt || new Date(),
          },
        });

        console.log(`✅ Migrated Microsoft data for owner ${owner.id} (${owner.microsoftEmail})`);
        migrated++;
      } catch (error) {
        console.error(`❌ Error migrating owner ${owner.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${ownersWithMicrosoft.length}`);

    if (migrated > 0) {
      console.log('\n⚠️  IMPORTANT: After verifying the migration, you should:');
      console.log('   1. Update all code to use MicrosoftAccount instead of owner.microsoft* fields');
      console.log('   2. Test thoroughly');
      console.log('   3. Remove Microsoft fields from owners model in schema.prisma');
      console.log('   4. Create and run a Prisma migration to remove the fields from database');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateMicrosoftData()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
