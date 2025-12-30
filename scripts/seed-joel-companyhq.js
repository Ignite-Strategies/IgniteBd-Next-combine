/**
 * Seed Joel's CompanyHQ with proper memberships and contact relationship
 * Run: node scripts/seed-joel-companyhq.js
 * 
 * Creates:
 * - Joel as Contact in Adam's CompanyHQ
 * - BusinessPoint Law CompanyHQ (owned by Joel's contact via contactOwnerId)
 * - Joel as OWNER (via membership)
 * - Adam as MANAGER (via membership)
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

    // Find Adam's CompanyHQ (Ignite Strategies)
    const adamCompanyHQ = await prisma.company_hqs.findFirst({
      where: {
        ownerId: adam.id,
        companyName: {
          contains: 'Ignite',
          mode: 'insensitive',
        },
      },
    });

    if (!adamCompanyHQ) {
      console.log('❌ Adam\'s CompanyHQ (Ignite Strategies) not found');
      console.log('   Please ensure Adam has a CompanyHQ before seeding Joel');
      process.exit(1);
    }
    console.log(`  ✅ Found Adam's CompanyHQ: ${adamCompanyHQ.companyName} (${adamCompanyHQ.id})`);

    // Find or create Joel as Owner (for membership)
    let joel = await prisma.owners.findFirst({
      where: { email: 'joel@businesspointlaw.com' }
    });

    if (!joel) {
      console.log('  ⚠️  Joel not found in owners. Creating...');
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
      console.log(`  ✅ Created Joel Owner: ${joel.email} (${joel.id})`);
    } else {
      console.log(`  ✅ Found Joel Owner: ${joel.email} (${joel.id})`);
      if (joel.firebaseId && joel.firebaseId.startsWith('joel_')) {
        console.log(`  ⚠️  Joel has placeholder Firebase ID: ${joel.firebaseId}`);
        console.log(`  💡 Run update-joel-firebase-id.js to set real Firebase ID`);
      }
    }

    // =====================================================
    // 1.5️⃣ CREATE JOEL AS CONTACT IN ADAM'S COMPANYHQ
    // =====================================================
    console.log('\n1.5️⃣ Creating Joel as Contact in Adam\'s CompanyHQ...');
    
    let joelContact = await prisma.contact.findFirst({
      where: {
        email: 'joel@businesspointlaw.com',
        crmId: adamCompanyHQ.id,
      },
    });

    if (!joelContact) {
      console.log('  📝 Creating Joel contact...');
      joelContact = await prisma.contact.create({
        data: {
          id: randomUUID(),
          crmId: adamCompanyHQ.id, // Lives in Adam's CompanyHQ
          email: 'joel@businesspointlaw.com',
          firstName: 'Joel',
          lastName: 'Gulick',
          fullName: 'Joel Gulick',
          role: 'contact', // Start as contact
          domain: 'businesspointlaw.com',
        },
      });
      console.log(`  ✅ Created Joel Contact: ${joelContact.email} (${joelContact.id})`);
    } else {
      console.log(`  ✅ Found Joel Contact: ${joelContact.email} (${joelContact.id})`);
    }

    // =====================================================
    // 2️⃣ CREATE OR FIND COMPANYHQ (BusinessPoint Law)
    // =====================================================
    console.log('\n2️⃣ Creating/finding BusinessPoint Law CompanyHQ...');
    
    // First, check if old readable ID exists (need to migrate)
    const oldHQ = await prisma.company_hqs.findUnique({
      where: { id: 'businesspoint-law-hq' }
    });

    if (oldHQ) {
      console.log('  ⚠️  Found CompanyHQ with old readable ID "businesspoint-law-hq"');
      console.log('  ⚠️  Run fix-businesspoint-law-hq-id.js first to migrate to UUID!');
      console.log(`  ℹ️  Current ID: ${oldHQ.id}`);
      process.exit(1);
    }

    // Try to find by company name instead
    let company = await prisma.company_hqs.findFirst({
      where: {
        companyName: 'BusinessPoint Law'
      }
    });

    const now = new Date();
    
    if (!company) {
      // Create new with proper UUID
      const newId = randomUUID();
      console.log(`  📝 Creating new CompanyHQ with UUID: ${newId}`);
      company = await prisma.company_hqs.create({
        data: {
          id: newId, // Use UUID, not readable string!
          companyName: 'BusinessPoint Law',
          companyIndustry: 'Legal Services',
          whatYouDo: 'Legal services and business law consulting',
          contactOwnerId: joelContact.id, // Joel's contact owns this CompanyHQ
          ownerId: joel.id, // Legacy field for compatibility
          createdAt: now,
          updatedAt: now,
        }
      });
      console.log(`  ✅ Created: ${company.companyName} (${company.id})`);
      console.log(`  ✅ Linked to Joel's Contact via contactOwnerId: ${joelContact.id}`);
    } else {
      console.log(`  ✅ Found existing: ${company.companyName} (${company.id})`);
      // Verify it's a UUID, not readable string
      if (company.id === 'businesspoint-law-hq' || !company.id.match(/^[a-f0-9-]{36}$/i)) {
        console.log('  ⚠️  CompanyHQ has invalid ID format! Run fix-businesspoint-law-hq-id.js');
        process.exit(1);
      }
      
      // Update existing company to ensure it has required fields and contactOwnerId
      const needsUpdate = !company.whatYouDo || !company.companyIndustry || !company.contactOwnerId;
      if (needsUpdate) {
        console.log(`  📝 Updating company to include required fields...`);
        company = await prisma.company_hqs.update({
          where: { id: company.id },
          data: {
            whatYouDo: company.whatYouDo || 'Legal services and business law consulting',
            companyIndustry: company.companyIndustry || 'Legal Services',
            contactOwnerId: company.contactOwnerId || joelContact.id, // Link to Joel's contact if missing
          }
        });
        console.log(`  ✅ Updated company with required fields`);
        if (!company.contactOwnerId && joelContact.id) {
          console.log(`  ✅ Linked to Joel's Contact via contactOwnerId: ${joelContact.id}`);
        }
      }
    }

    // Update Joel's contact to set role to 'owner' since he owns BusinessPoint Law
    if (joelContact.role !== 'owner') {
      console.log(`  📝 Updating Joel's contact role to 'owner'...`);
      await prisma.contact.update({
        where: { id: joelContact.id },
        data: { role: 'owner' },
      });
      console.log(`  ✅ Updated Joel's contact role to 'owner'`);
    }

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
      },
      create: {
        id: randomUUID(),
        userId: joel.id,
        companyHqId: company.id,
        role: 'OWNER',
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
      },
      create: {
        id: randomUUID(),
        userId: adam.id,
        companyHqId: company.id,
        role: 'MANAGER',
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
      console.log(`    • ${m.owners.email}: ${m.role}`);
    });

    // =====================================================
    // ✅ SUCCESS
    // =====================================================
    console.log('\n🎉 Seed completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   Joel Contact: ${joelContact.email} (${joelContact.id}) in ${adamCompanyHQ.companyName}`);
    console.log(`   CompanyHQ: ${company.companyName} (${company.id})`);
    console.log(`   CompanyHQ contactOwnerId: ${company.contactOwnerId} (Joel's Contact)`);
    console.log(`   Joel Owner (OWNER): ${joel.email}`);
    console.log(`   Adam (MANAGER): ${adam.email}`);
    console.log('\n✅ The CRM should now work for both Joel and Adam using resolveMembership()');
    console.log('✅ Joel exists as a Contact in Adam\'s CompanyHQ and owns BusinessPoint Law');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedJoelCompanyHQ();
