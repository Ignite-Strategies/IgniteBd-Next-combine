/**
 * Add paidAt column to bills table
 * Run: node scripts/add-paid-at-column.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function addPaidAtColumn() {
  try {
    console.log('🔄 Adding paidAt column to bills table...')
    
    // Add column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP;
    `)
    console.log('✅ Added paidAt column')
    
    // Add index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "bills_paidAt_idx" ON "bills"("paidAt");
    `)
    console.log('✅ Created index')
    
    // Backfill paidAt for existing PAID bills
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "bills" 
      SET "paidAt" = "updatedAt" 
      WHERE "status" = 'PAID' AND "paidAt" IS NULL;
    `)
    console.log(`✅ Backfilled paidAt for ${result} bills`)
    
    // Verify
    const billsWithPaidAt = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "bills" WHERE "paidAt" IS NOT NULL;
    `)
    console.log(`✅ Verified: ${billsWithPaidAt[0].count} bills have paidAt set`)
    
    console.log('✅ Migration complete!')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addPaidAtColumn()
  .then(() => {
    console.log('✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Failed:', error)
    process.exit(1)
  })
