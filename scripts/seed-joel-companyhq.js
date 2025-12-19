/**
 * Seed Joel's CompanyHQ with proper memberships
 * Run: node scripts/seed-joel-companyhq.js
 * 
 * Creates:
 * - BusinessPoint Law CompanyHQ
 * - Joel as OWNER
 * - Adam as MANAGER
 * 
 * Idempotent: Safe to run multiple times
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function seedJoelCompanyHQ() {
  try {
    console.log('🌱 Seeding Joel\'s CompanyHQ with Memberships...\n');

    // =====================================================
    // 1️⃣ RESOLVE OWNERS (Adam + Joel)
    // =====================================================
    console.log('1️⃣ Resolving owners...');
    
    const adam = await prisma.owners.findFirst({
      where: { email: 'adam.ignitestrategies@gmail.com' }
    });

    if (!adam) {
      console.log('❌ Adam not found in owners table');
      process.exit(1);
    }
    console.log(`  ✅ Found Adam: ${adam.email} (${adam.id})`);

    let joel = await prisma.owners.findFirst({
      where: { email: 'joel@businesspointlaw.com' }
    });

    if (!joel) {
      console.log('  ⚠️  Joel not found. Creating...');
      console.log('  ⚠️  Note: Will create with placeholder Firebase ID');
      console.log('  💡 Run update-joel-firebase-id.js to set real Firebase ID after Joel authenticates');
      const now = new Date();
      joel = await prisma.owners.create({
        data: {
          id: randomUUID(),
          firebaseId: `joel_${Date.now()}`, // Placeholder until real Firebase auth
          email: 'joel@businesspointlaw.com',
          name: 'Joel Gulick',
          firstName: 'Joel',
          lastName: 'Gulick',
          createdAt: now,
          updatedAt: now,
        }
      });
      console.log(`  ✅ Created Joel: ${joel.email} (${joel.id})`);
    } else {
      console.log(`  ✅ Found Joel: ${joel.email} (${joel.id})`);
      if (joel.firebaseId && joel.firebaseId.startsWith('joel_')) {
        console.log(`  ⚠️  Joel has placeholder Firebase ID: ${joel.firebaseId}`);
        console.log(`  💡 Run update-joel-firebase-id.js to set real Firebase ID`);
      }
    }

    // =====================================================
    // 2️⃣ CREATE OR FIND COMPANYHQ (BusinessPoint Law)
    // =====================================================
    console.log('\n2️⃣ Creating/finding BusinessPoint Law CompanyHQ...');
    
    const now = new Date();
    const company = await prisma.company_hqs.upsert({
      where: { 
        id: 'businesspoint-law-hq' // Use a stable ID for idempotency
      },
      update: {
        companyName: 'BusinessPoint Law',
        updatedAt: now,
      },
      create: {
        id: 'businesspoint-law-hq',
        companyName: 'BusinessPoint Law',
        companyIndustry: 'Legal Services',
        ownerId: joel.id, // Legacy field for compatibility
        createdAt: now,
        updatedAt: now,
      }
    });

    console.log(`  ✅ CompanyHQ ready: ${company.companyName} (${company.id})`);

    // =====================================================
    // 3️⃣ CREATE MEMBERSHIPS (Idempotent)
    // =====================================================
    console.log('\n3️⃣ Creating memberships...');

    // Joel → OWNER
    const joelMembership = await prisma.company_memberships.upsert({
      where: {
        userId_companyHqId: {
          userId: joel.id,
          companyHqId: company.id,
        },
      },
      update: { 
        role: 'OWNER',
        isPrimary: true,
      },
      create: {
        id: randomUUID(),
        userId: joel.id,
        companyHqId: company.id,
        role: 'OWNER',
        isPrimary: true,
      },
    });
    console.log(`  ✅ Joel → OWNER (${joelMembership.id})`);

    // Adam → MANAGER
    const adamMembership = await prisma.company_memberships.upsert({
      where: {
        userId_companyHqId: {
          userId: adam.id,
          companyHqId: company.id,
        },
      },
      update: { 
        role: 'MANAGER',
        isPrimary: false,
      },
      create: {
        id: randomUUID(),
        userId: adam.id,
        companyHqId: company.id,
        role: 'MANAGER',
        isPrimary: false,
      },
    });
    console.log(`  ✅ Adam → MANAGER (${adamMembership.id})`);

    // =====================================================
    // 4️⃣ VERIFICATION
    // =====================================================
    console.log('\n4️⃣ Verifying memberships...');
    
    const memberships = await prisma.company_memberships.findMany({
      where: { companyHqId: company.id },
      include: {
        owners: {
          select: {
            email: true,
            name: true,
          }
        }
      }
    });

    console.log(`  Found ${memberships.length} memberships:`);
    memberships.forEach(m => {
      console.log(`    • ${m.owners.email}: ${m.role}${m.isPrimary ? ' (Primary)' : ''}`);
    });

    // =====================================================
    // ✅ SUCCESS
    // =====================================================
    console.log('\n🎉 Seed completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   CompanyHQ: ${company.companyName} (${company.id})`);
    console.log(`   Joel (OWNER): ${joel.email}`);
    console.log(`   Adam (MANAGER): ${adam.email}`);
    console.log('\n✅ The CRM should now work for both Joel and Adam using resolveMembership()');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedJoelCompanyHQ();
