/**
 * Safe Migration Script: BuyingReadiness Enum Update
 * 
 * This script safely migrates existing data before changing the enum values
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

  try {
    // Step 1: Check current data
    const contactsWithOldValues = await prisma.contact.findMany({
      where: {
        buyingReadiness: {
          in: ['READ_BUT_NO_MONEY', 'MONEY_AND_READY'],
        },
      },
      select: {
        id: true,
        buyingReadiness: true,
      },
    });

    console.log(`📊 Found ${contactsWithOldValues.length} contacts with old enum values`);

    if (contactsWithOldValues.length === 0) {
      console.log('✅ No data to migrate. Safe to proceed with enum update.');
      return;
    }

    // Step 2: Show what will be migrated
    const readButNoMoney = contactsWithOldValues.filter(
      (c) => c.buyingReadiness === 'READ_BUT_NO_MONEY'
    ).length;
    const moneyAndReady = contactsWithOldValues.filter(
      (c) => c.buyingReadiness === 'MONEY_AND_READY'
    ).length;

    console.log(`   - READ_BUT_NO_MONEY → READY_NO_MONEY: ${readButNoMoney} contacts`);
    console.log(`   - MONEY_AND_READY → READY_WITH_MONEY: ${moneyAndReady} contacts`);

    // Step 3: Migrate READ_BUT_NO_MONEY → READY_NO_MONEY
    if (readButNoMoney > 0) {
      const result1 = await prisma.$executeRaw`
        UPDATE contacts
        SET "buyingReadiness" = 'READY_NO_MONEY'::text
        WHERE "buyingReadiness" = 'READ_BUT_NO_MONEY'::text
      `;
      console.log(`✅ Migrated ${result1} contacts: READ_BUT_NO_MONEY → READY_NO_MONEY`);
    }

    // Step 4: Migrate MONEY_AND_READY → READY_WITH_MONEY
    if (moneyAndReady > 0) {
      const result2 = await prisma.$executeRaw`
        UPDATE contacts
        SET "buyingReadiness" = 'READY_WITH_MONEY'::text
        WHERE "buyingReadiness" = 'MONEY_AND_READY'::text
      `;
      console.log(`✅ Migrated ${result2} contacts: MONEY_AND_READY → READY_WITH_MONEY`);
    }

    // Step 5: Verify migration
    const remaining = await prisma.contact.findMany({
      where: {
        buyingReadiness: {
          in: ['READ_BUT_NO_MONEY', 'MONEY_AND_READY'],
        },
      },
    });

    if (remaining.length > 0) {
      throw new Error(
        `❌ Migration failed: ${remaining.length} contacts still have old enum values`
      );
    }

    console.log('✅ Migration completed successfully!');
    console.log('✅ Safe to run: npx prisma db push');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateBuyingReadiness()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
