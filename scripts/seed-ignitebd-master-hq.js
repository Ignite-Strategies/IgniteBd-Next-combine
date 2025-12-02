/**
 * Seed IgniteBD Master CompanyHQ
 * Run: node scripts/seed-ignitebd-master-hq.js [ownerEmail]
 * 
 * Creates the IgniteBD Master CompanyHQ with id "ignitebd_master_hq"
 * If ownerEmail is provided, finds that Owner and sets as managerId
 * Otherwise, uses the first Owner found
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedIgniteBDMasterHQ() {
  try {
    const ownerEmail = process.argv[2];

    // Find Owner (by email if provided, otherwise first Owner)
    let owner;
    if (ownerEmail) {
      owner = await prisma.owner.findFirst({
        where: {
          email: {
            contains: ownerEmail,
            mode: 'insensitive',
          },
        },
      });
      
      if (!owner) {
        console.log(`❌ Owner not found with email containing: ${ownerEmail}`);
        return;
      }
    } else {
      owner = await prisma.owner.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      
      if (!owner) {
        console.log('❌ No Owners found in database');
        return;
      }
    }

    console.log('✅ Found Owner:', {
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    // Check if IgniteBD Master HQ already exists
    const existingMasterHQ = await prisma.companyHQ.findUnique({
      where: { id: 'ignitebd_master_hq' },
    });

    if (existingMasterHQ) {
      console.log('⚠️  IgniteBD Master HQ already exists, updating managerId...');
      
      const updated = await prisma.companyHQ.update({
        where: { id: 'ignitebd_master_hq' },
        data: {
          managerId: owner.id,
        },
      });

      console.log('✅ Updated IgniteBD Master HQ:', {
        id: updated.id,
        companyName: updated.companyName,
        managerId: updated.managerId,
      });
    } else {
      // Create IgniteBD Master HQ
      const masterHQ = await prisma.companyHQ.create({
        data: {
          id: 'ignitebd_master_hq',
          companyName: 'IgniteBD Master',
          managerId: owner.id,
        },
      });

      console.log('✅ Created IgniteBD Master HQ:', {
        id: masterHQ.id,
        companyName: masterHQ.companyName,
        managerId: masterHQ.managerId,
      });
    }

    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding IgniteBD Master HQ:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedIgniteBDMasterHQ();

