/**
 * Migration Script: Split owner.name into firstName and lastName
 * 
 * This script migrates existing owner records that have a full name in the `name` field
 * and splits them into `firstName` and `lastName` fields.
 * 
 * Usage: node scripts/migrate-owner-names.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateOwnerNames() {
  console.log('🚀 Starting owner name migration...\n');

  try {
    // Find all owners
    const allOwners = await prisma.owners.findMany({
      select: {
        id: true,
        firebaseId: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    // Filter to owners that need migration (have name but no firstName/lastName, or neither)
    const owners = allOwners.filter(owner => {
      const hasName = owner.name && owner.name.trim().length > 0;
      const hasFirstName = owner.firstName && owner.firstName.trim().length > 0;
      const hasLastName = owner.lastName && owner.lastName.trim().length > 0;
      return hasName && (!hasFirstName || !hasLastName);
    });

    console.log(`Found ${owners.length} owner(s) to process\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const owner of owners) {
      try {
        // Skip if already has firstName and lastName
        if (owner.firstName && owner.lastName) {
          console.log(`⏭️  Skipping ${owner.id} - already has firstName and lastName`);
          skipped++;
          continue;
        }

        // If name exists, split it
        if (owner.name) {
          const nameParts = owner.name.trim().split(/\s+/);
          const firstName = nameParts[0] || null;
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

          await prisma.owners.update({
            where: { id: owner.id },
            data: {
              firstName: firstName,
              lastName: lastName,
            },
          });

          console.log(`✅ Migrated ${owner.id}: "${owner.name}" -> firstName: "${firstName}", lastName: "${lastName}"`);
          migrated++;
        } else if (!owner.firstName && !owner.lastName) {
          // No name at all - try to extract from email
          if (owner.email) {
            const emailName = owner.email.split('@')[0];
            await prisma.owners.update({
              where: { id: owner.id },
              data: {
                firstName: emailName,
                lastName: null,
              },
            });
            console.log(`✅ Migrated ${owner.id}: extracted firstName "${emailName}" from email`);
            migrated++;
          } else {
            console.log(`⏭️  Skipping ${owner.id} - no name or email to migrate`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error migrating owner ${owner.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateOwnerNames()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
