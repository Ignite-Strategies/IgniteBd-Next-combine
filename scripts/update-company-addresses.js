/**
 * Update company addresses for invoice display
 * Run: node scripts/update-company-addresses.js
 * 
 * Updates:
 * - Ignite Strategies companies with Ignite Strategies LLC address
 * - Other companies can be updated manually or via this script
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateCompanyAddresses() {
  try {
    console.log('🌱 Updating company addresses...\n');

    // Find Ignite Strategies companies
    const igniteCompanies = await prisma.company_hqs.findMany({
      where: {
        companyName: {
          contains: 'Ignite',
          mode: 'insensitive',
        },
      },
    });

    console.log(`Found ${igniteCompanies.length} Ignite Strategies companies`);

    for (const company of igniteCompanies) {
      const needsUpdate = !company.companyStreet || !company.companyCity || !company.companyState;
      
      if (needsUpdate) {
        console.log(`\n📝 Updating ${company.companyName} (${company.id})...`);
        const updated = await prisma.company_hqs.update({
          where: { id: company.id },
          data: {
            companyStreet: '2604 N. George Mason Dr.',
            companyCity: 'Arlington',
            companyState: 'VA',
            companyZip: '22207',
          },
        });
        console.log(`  ✅ Updated address: ${updated.companyStreet}, ${updated.companyCity}, ${updated.companyState} ${updated.companyZip || ''}`);
      } else {
        console.log(`\n✓ ${company.companyName} already has address`);
        console.log(`  ${company.companyStreet}, ${company.companyCity}, ${company.companyState}`);
      }
    }

    // List all companies and their address status
    console.log('\n\n📋 All Companies Address Status:');
    const allCompanies = await prisma.company_hqs.findMany({
      select: {
        id: true,
        companyName: true,
        companyStreet: true,
        companyCity: true,
        companyState: true,
        companyZip: true,
      },
      orderBy: { companyName: 'asc' },
    });

    allCompanies.forEach((c) => {
      const hasAddress = c.companyStreet && c.companyCity && c.companyState;
      const status = hasAddress ? '✅' : '❌';
      const addressParts = [];
      if (c.companyStreet) addressParts.push(c.companyStreet);
      const cityStateZip = [c.companyCity, c.companyState, c.companyZip].filter(Boolean).join(', ');
      if (cityStateZip) addressParts.push(cityStateZip);
      const address = hasAddress ? addressParts.join('\n  ') : 'No address';
      console.log(`  ${status} ${c.companyName}:`);
      console.log(`     ${address}`);
    });

    console.log('\n✅ Address update complete!');
  } catch (error) {
    console.error('❌ Error updating addresses:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateCompanyAddresses();
