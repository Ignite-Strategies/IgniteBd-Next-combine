import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findData() {
  console.log('🔍 Finding IgniteBD data...\n');

  // 1. Find IgniteBD CompanyHQ
  console.log('1️⃣ Looking for IgniteBD CompanyHQ...');
  const igniteHQs = await prisma.company_hqs.findMany({
    where: {
      OR: [
        { companyName: { contains: 'Ignite', mode: 'insensitive' } },
        { companyName: { contains: 'ignite', mode: 'insensitive' } }
      ]
    },
    take: 5,
    select: {
      id: true,
      companyName: true,
      ownerId: true,
      contactOwnerId: true,
      ultraTenantId: true
      // platformId: true // Not in DB yet
    }
  });

  console.log('Found IgniteBD CompanyHQs:');
  igniteHQs.forEach(hq => {
    console.log(`  - ${hq.companyName}`);
    console.log(`    ID: ${hq.id}`);
    console.log(`    ownerId: ${hq.ownerId || 'null'}`);
    console.log(`    contactOwnerId: ${hq.contactOwnerId || 'null'}`);
    console.log(`    ultraTenantId: ${hq.ultraTenantId || 'null'}`);
    console.log('');
  });

  // 2. Find Adam's Owner record
  console.log('\n2️⃣ Looking for Adam\'s Owner record...');
  const adamOwners = await prisma.owners.findMany({
    where: {
      OR: [
        { email: { contains: 'adam', mode: 'insensitive' } },
        { firstName: { contains: 'Adam', mode: 'insensitive' } },
        { lastName: { contains: 'Cole', mode: 'insensitive' } }
      ]
    },
    take: 5,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      firebaseId: true
    }
  });

  console.log('Found Owner records:');
  adamOwners.forEach(owner => {
    console.log(`  - ${owner.firstName} ${owner.lastName} (${owner.email})`);
    console.log(`    ID: ${owner.id}`);
    console.log(`    firebaseId: ${owner.firebaseId}`);
    console.log('');
  });

  // 3. Check if ultra_platform table exists
  console.log('\n3️⃣ Checking ultra_platform table...');
  try {
    const platformCount = await prisma.ultra_platform.count();
    console.log(`Found ${platformCount} platform records`);
    
    if (platformCount > 0) {
      const platforms = await prisma.ultra_platform.findMany();
      platforms.forEach(p => {
        console.log(`  - ${p.name} (ID: ${p.id})`);
      });
    }
  } catch (error) {
    console.log('  ⚠️  ultra_platform table does not exist yet (need to run migration)');
  }

  // 4. Check super_admins
  console.log('\n4️⃣ Checking super_admins...');
  try {
    const admins = await prisma.super_admins.findMany({
      include: {
        owners: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    if (admins.length > 0) {
      console.log(`Found ${admins.length} super admin(s):`);
      admins.forEach(admin => {
        console.log(`  - ${admin.owners.firstName} ${admin.owners.lastName} (${admin.owners.email})`);
        console.log(`    ID: ${admin.id}`);
        console.log(`    ownerId: ${admin.ownerId}`);
      });
    } else {
      console.log('  No super admins found');
    }
  } catch (error) {
    console.log('  Error checking super_admins:', error.message);
  }
}

findData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
