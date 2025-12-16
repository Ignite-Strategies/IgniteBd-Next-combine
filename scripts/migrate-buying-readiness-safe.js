/**
 * Safe Migration Script: BuyingReadiness Enum Update
 * 
 * This script uses raw SQL to safely migrate existing data before changing enum values
 * 
 * Old values: READ_BUT_NO_MONEY, MONEY_AND_READY
 * New values: NOT_READY, READY_NO_MONEY, READY_WITH_MONEY
 * 
 * Mapping:
 *   READ_BUT_NO_MONEY → READY_NO_MONEY
 *   MONEY_AND_READY → READY_WITH_MONEY
 *   NULL → NULL (unchanged)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateBuyingReadiness() {
  console.log('🔄 Starting BuyingReadiness enum migration...');
  console.log('📋 This script will safely migrate data before enum changes\n');

  try {
    // Step 1: Check current data using raw SQL (bypasses Prisma enum validation)
    const checkQuery = await prisma.$queryRaw`
      SELECT 
        "buyingReadiness",
        COUNT(*) as count
      FROM contacts
      WHERE "buyingReadiness" IN ('READ_BUT_NO_MONEY', 'MONEY_AND_READY')
      GROUP BY "buyingReadiness"
    `;

    console.log('📊 Current data status:');
    if (checkQuery.length === 0) {
      console.log('   ✅ No contacts with old enum values found');
      console.log('   ✅ Safe to proceed with enum update');
      return { success: true, migrated: 0 };
    }

    let totalToMigrate = 0;
    checkQuery.forEach((row) => {
      console.log(`   - ${row.buyingReadiness}: ${row.count} contacts`);
      totalToMigrate += parseInt(row.count);
    });

    console.log(`\n📝 Total contacts to migrate: ${totalToMigrate}`);

    // Step 2: Migrate READ_BUT_NO_MONEY → READY_NO_MONEY
    const result1 = await prisma.$executeRaw`
      UPDATE contacts
      SET "buyingReadiness" = 'READY_NO_MONEY'::text
      WHERE "buyingReadiness" = 'READ_BUT_NO_MONEY'::text
    `;
    console.log(`✅ Migrated ${result1} contacts: READ_BUT_NO_MONEY → READY_NO_MONEY`);

    // Step 3: Migrate MONEY_AND_READY → READY_WITH_MONEY
    const result2 = await prisma.$executeRaw`
      UPDATE contacts
      SET "buyingReadiness" = 'READY_WITH_MONEY'::text
      WHERE "buyingReadiness" = 'MONEY_AND_READY'::text
    `;
    console.log(`✅ Migrated ${result2} contacts: MONEY_AND_READY → READY_WITH_MONEY`);

    // Step 4: Verify migration - check for any remaining old values
    const verifyQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM contacts
      WHERE "buyingReadiness" IN ('READ_BUT_NO_MONEY', 'MONEY_AND_READY')
    `;

    const remaining = parseInt(verifyQuery[0].count);
    if (remaining > 0) {
      throw new Error(
        `❌ Migration failed: ${remaining} contacts still have old enum values`
      );
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('✅ All data safely migrated');
    console.log('✅ Safe to run: npx prisma db push');
    
    return { success: true, migrated: result1 + result2 };
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateBuyingReadiness()
  .then((result) => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error.message);
    process.exit(1);
  });
