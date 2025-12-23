/**
 * Check current state of Joel and Adam in the database
 * Run: node scripts/check-joel-adam-state.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkState() {
  try {
    console.log('🔍 Checking Joel and Adam state...\n');

    // Check Joel
    console.log('1️⃣ Joel (joel@businesspointlaw.com):');
    const joel = await prisma.owners.findFirst({
      where: { email: 'joel@businesspointlaw.com' }
    });

    if (!joel) {
      console.log('   ❌ Joel not found in database');
    } else {
      console.log(`   ✅ Found Joel:`);
      console.log(`      ID: ${joel.id}`);
      console.log(`      Email: ${joel.email}`);
      console.log(`      Firebase ID: ${joel.firebaseId}`);
      console.log(`      Name: ${joel.name || `${joel.firstName} ${joel.lastName}`}`);

      // Check Joel's memberships
      const joelMemberships = await prisma.company_memberships.findMany({
        where: { userId: joel.id },
        include: {
          company_hqs: {
            select: {
              id: true,
              companyName: true,
            }
          }
        }
      });

      console.log(`      Memberships: ${joelMemberships.length}`);
      joelMemberships.forEach(m => {
        console.log(`         • ${m.company_hqs.companyName}: ${m.role}`);
      });
    }

    // Check Adam
    console.log('\n2️⃣ Adam (adam.ignitestrategies@gmail.com):');
    const adam = await prisma.owners.findFirst({
      where: { email: 'adam.ignitestrategies@gmail.com' }
    });

    if (!adam) {
      console.log('   ❌ Adam not found in database');
    } else {
      console.log(`   ✅ Found Adam:`);
      console.log(`      ID: ${adam.id}`);
      console.log(`      Email: ${adam.email}`);
      console.log(`      Firebase ID: ${adam.firebaseId}`);
      console.log(`      Name: ${adam.name || `${adam.firstName} ${adam.lastName}`}`);

      // Check Adam's memberships
      const adamMemberships = await prisma.company_memberships.findMany({
        where: { userId: adam.id },
        include: {
          company_hqs: {
            select: {
              id: true,
              companyName: true,
            }
          }
        },
        orderBy: [
          { createdAt: 'asc' },
        ]
      });

      console.log(`      Memberships: ${adamMemberships.length}`);
      adamMemberships.forEach(m => {
        console.log(`         • ${m.company_hqs.companyName}: ${m.role}`);
      });
    }

    // Check BusinessPoint Law CompanyHQ
    console.log('\n3️⃣ BusinessPoint Law CompanyHQ:');
    const bplCompany = await prisma.company_hqs.findUnique({
      where: { id: 'businesspoint-law-hq' }
    });

    if (!bplCompany) {
      console.log('   ❌ BusinessPoint Law CompanyHQ not found');
    } else {
      console.log(`   ✅ Found: ${bplCompany.companyName} (${bplCompany.id})`);

      // Check all memberships for this company
      const companyMemberships = await prisma.company_memberships.findMany({
        where: { companyHqId: bplCompany.id },
        include: {
          owners: {
            select: {
              email: true,
              firebaseId: true,
            }
          }
        }
      });

      console.log(`      Total memberships: ${companyMemberships.length}`);
      companyMemberships.forEach(m => {
        console.log(`         • ${m.owners.email} (${m.owners.firebaseId}): ${m.role}`);
      });
    }

    console.log('\n✅ State check complete!');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkState();

