/**
 * Seed BusinessPoint Law address
 * Run: node scripts/seed-businesspoint-address.js
 * 
 * Updates BusinessPoint Law with address information for invoice display
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedBusinessPointAddress() {
  try {
    console.log('🌱 Seeding BusinessPoint Law address...\n');

    // Find BusinessPoint Law
    const company = await prisma.company_hqs.findFirst({
      where: {
        companyName: {
          contains: 'BusinessPoint',
          mode: 'insensitive',
        },
      },
    });

    if (!company) {
      console.log('❌ BusinessPoint Law not found');
      process.exit(1);
    }

    console.log(`Found: ${company.companyName} (${company.id})`);
    console.log(`Current address: ${company.companyStreet || 'None'}, ${company.companyCity || 'None'}, ${company.companyState || 'None'}`);

    // Update with BusinessPoint Law address
    const address = {
      companyStreet: '3031 Wilson Boulevard, Suite 500',
      companyCity: 'Arlington',
      companyState: 'VA',
      companyZip: '22201',
    };

    const updated = await prisma.company_hqs.update({
      where: { id: company.id },
      data: address,
    });

    console.log('\n✅ Updated BusinessPoint Law address:');
    console.log(`   Street: ${updated.companyStreet}`);
    console.log(`   City: ${updated.companyCity}`);
    console.log(`   State: ${updated.companyState}`);
    console.log(`   Zip: ${updated.companyZip}`);
    console.log('\n✅ Address seeding complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedBusinessPointAddress();
