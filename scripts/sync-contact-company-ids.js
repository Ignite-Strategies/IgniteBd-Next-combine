/**
 * Migration Script: Sync contactCompanyId from companyId
 * 
 * Fixes the schema bifurcation issue where contacts have companyId (enrichment field)
 * but contactCompanyId (FK) is null. This script copies companyId → contactCompanyId
 * where contactCompanyId is null and companyId has a valid value.
 * 
 * Run with: node scripts/sync-contact-company-ids.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncContactCompanyIds() {
  console.log('🔄 Starting contactCompanyId sync...');
  
  try {
    // Find all contacts where contactCompanyId is null but companyId has a value
    const contactsToSync = await prisma.contact.findMany({
      where: {
        contactCompanyId: null,
        companyId: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyId: true,
        contactCompanyId: true,
      },
    });

    console.log(`📊 Found ${contactsToSync.length} contacts to sync`);

    if (contactsToSync.length === 0) {
      console.log('✅ No contacts need syncing');
      return;
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const contact of contactsToSync) {
      try {
        // Verify the companyId actually exists in companies table
        const company = await prisma.companies.findUnique({
          where: { id: contact.companyId },
        });

        if (!company) {
          console.warn(`⚠️  Skipping contact ${contact.id} (${contact.email}): companyId ${contact.companyId} does not exist in companies table`);
          skipped++;
          continue;
        }

        // Update contactCompanyId (FK) from companyId (enrichment field)
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            contactCompanyId: contact.companyId,
          },
        });

        synced++;
        console.log(`✅ Synced contact ${contact.id} (${contact.firstName} ${contact.lastName}): contactCompanyId = ${contact.companyId}`);
      } catch (error) {
        console.error(`❌ Error syncing contact ${contact.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Sync Summary:');
    console.log(`   ✅ Synced: ${synced}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${contactsToSync.length}`);

    if (synced > 0) {
      console.log('\n✅ Migration complete! Contacts now have contactCompanyId (FK) set correctly.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
syncContactCompanyIds()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
