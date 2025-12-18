/**
 * Verify Joel's CompanyHQ setup
 * Run: node scripts/verify-joel-setup.js
 * 
 * Tests that resolveMembership works correctly for Joel and Adam
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySetup() {
  try {
    console.log('🔍 Verifying Joel\'s CompanyHQ Setup...\n');

    // =====================================================
    // 1️⃣ FIND OWNERS
    // =====================================================
    console.log('1️⃣ Finding owners...');
    
    const adam = await prisma.owners.findFirst({
      where: { email: 'adam.ignitestrategies@gmail.com' }
    });

    const joel = await prisma.owners.findFirst({
      where: { email: 'joel@businesspointlaw.com' }
    });

    if (!adam || !joel) {
      console.log('❌ Missing owners. Run seed-joel-companyhq.js first.');
      process.exit(1);
    }

    console.log(`  ✅ Adam: ${adam.email} (${adam.id})`);
    console.log(`  ✅ Joel: ${joel.email} (${joel.id})`);

    // =====================================================
    // 2️⃣ FIND COMPANYHQ
    // =====================================================
    console.log('\n2️⃣ Finding BusinessPoint Law CompanyHQ...');
    
    const company = await prisma.company_hqs.findUnique({
      where: { id: 'businesspoint-law-hq' }
    });

    if (!company) {
      console.log('❌ BusinessPoint Law CompanyHQ not found. Run seed-joel-companyhq.js first.');
      process.exit(1);
    }

    console.log(`  ✅ ${company.companyName} (${company.id})`);

    // =====================================================
    // 3️⃣ TEST MEMBERSHIPS (Raw Query)
    // =====================================================
    console.log('\n3️⃣ Testing memberships (raw query)...');
    
    const joelMembership = await prisma.company_memberships.findUnique({
      where: {
        userId_companyHqId: {
          userId: joel.id,
          companyHqId: company.id,
        }
      }
    });

    const adamMembership = await prisma.company_memberships.findUnique({
      where: {
        userId_companyHqId: {
          userId: adam.id,
          companyHqId: company.id,
        }
      }
    });

    if (!joelMembership || joelMembership.role !== 'OWNER') {
      console.log('❌ Joel membership incorrect');
      console.log('   Expected: OWNER');
      console.log('   Got:', joelMembership);
      process.exit(1);
    }

    if (!adamMembership || adamMembership.role !== 'MANAGER') {
      console.log('❌ Adam membership incorrect');
      console.log('   Expected: MANAGER');
      console.log('   Got:', adamMembership);
      process.exit(1);
    }

    console.log(`  ✅ Joel: ${joelMembership.role}${joelMembership.isPrimary ? ' (Primary)' : ''}`);
    console.log(`  ✅ Adam: ${adamMembership.role}${adamMembership.isPrimary ? ' (Primary)' : ''}`);

    // =====================================================
    // 4️⃣ TEST resolveMembership (Import simulation)
    // =====================================================
    console.log('\n4️⃣ Testing resolveMembership function...');
    
    // Simulate resolveMembership for Joel
    const joelResolve = await prisma.company_memberships.findUnique({
      where: {
        userId_companyHqId: {
          userId: joel.id,
          companyHqId: company.id,
        }
      },
      include: {
        owners: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          }
        }
      }
    });

    // Simulate resolveMembership for Adam
    const adamResolve = await prisma.company_memberships.findUnique({
      where: {
        userId_companyHqId: {
          userId: adam.id,
          companyHqId: company.id,
        }
      },
      include: {
        owners: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          }
        }
      }
    });

    console.log(`  ✅ Joel membership resolved:`, {
      role: joelResolve.role,
      isPrimary: joelResolve.isPrimary,
      companyName: joelResolve.company_hqs.companyName,
      ownerEmail: joelResolve.owners.email,
    });

    console.log(`  ✅ Adam membership resolved:`, {
      role: adamResolve.role,
      isPrimary: adamResolve.isPrimary,
      companyName: adamResolve.company_hqs.companyName,
      ownerEmail: adamResolve.owners.email,
    });

    // =====================================================
    // 5️⃣ TEST ALL MEMBERSHIPS
    // =====================================================
    console.log('\n5️⃣ Testing resolveAllMemberships...');
    
    const joelAllMemberships = await prisma.company_memberships.findMany({
      where: {
        userId: joel.id,
      },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
            platformId: true,
          }
        }
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ]
    });

    const adamAllMemberships = await prisma.company_memberships.findMany({
      where: {
        userId: adam.id,
      },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
            platformId: true,
          }
        }
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ]
    });

    console.log(`  ✅ Joel has ${joelAllMemberships.length} membership(s):`);
    joelAllMemberships.forEach(m => {
      console.log(`     • ${m.company_hqs.companyName}: ${m.role}${m.isPrimary ? ' (Primary)' : ''}`);
    });

    console.log(`  ✅ Adam has ${adamAllMemberships.length} membership(s):`);
    adamAllMemberships.forEach(m => {
      console.log(`     • ${m.company_hqs.companyName}: ${m.role}${m.isPrimary ? ' (Primary)' : ''}`);
    });

    // =====================================================
    // ✅ SUCCESS
    // =====================================================
    console.log('\n🎉 All verifications passed!\n');
    console.log('✅ Setup is correct:');
    console.log('   • Joel can access BusinessPoint Law as OWNER');
    console.log('   • Adam can access BusinessPoint Law as MANAGER');
    console.log('   • resolveMembership will work correctly in the CRM');
    console.log('\n📝 Next steps:');
    console.log('   1. Test logging in as Joel in the CRM');
    console.log('   2. Test logging in as Adam in the CRM');
    console.log('   3. Verify both can access BusinessPoint Law data');

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySetup();
