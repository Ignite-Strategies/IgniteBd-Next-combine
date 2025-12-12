/**
 * Add gammaGenerationId column to presentations table
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding gammaGenerationId column to presentations table...');
    
    // Add column if it doesn't exist
    await prisma.$executeRaw`
      ALTER TABLE presentations 
      ADD COLUMN IF NOT EXISTS "gammaGenerationId" TEXT;
    `;
    
    console.log('✅ Column added successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

