/**
 * Check what columns exist in the templates table
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    // Check all columns in templates table
    const allColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'templates'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nAll columns in templates table:');
    console.log(allColumns);
    
    // Check specifically for createdBy
    const createdByCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'templates' 
      AND column_name = 'createdBy';
    `);
    
    console.log('\ncreatedBy column exists:', createdByCheck.length > 0);
    
    // Check for companyHQId
    const companyHQIdCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'templates' 
      AND column_name = 'companyHQId';
    `);
    
    console.log('companyHQId column exists:', companyHQIdCheck.length > 0);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();

