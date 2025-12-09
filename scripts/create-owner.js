/**
 * Create Owner Record Script
 * Run: node scripts/create-owner.js [firebaseId] [email] [name]
 * 
 * Creates an Owner record for the specified Firebase UID
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createOwner() {
  try {
    const firebaseId = process.argv[2];
    const email = process.argv[3] || null;
    const name = process.argv[4] || null;

    if (!firebaseId) {
      console.log('❌ Usage: node scripts/create-owner.js [firebaseId] [email] [name]');
      console.log('');
      console.log('Example:');
      console.log('  node scripts/create-owner.js abc123xyz user@example.com "User Name"');
      console.log('');
      console.log('To get your Firebase UID:');
      console.log('  1. Open browser console on your app');
      console.log('  2. Run: firebase.auth().currentUser.uid');
      return;
    }

    // Check if Owner already exists
    const existing = await prisma.owner.findUnique({
      where: { firebaseId },
    });

    if (existing) {
      console.log('⚠️  Owner already exists:');
      console.log({
        id: existing.id,
        firebaseId: existing.firebaseId,
        email: existing.email,
        name: existing.name,
      });
      console.log('');
      console.log('To update, use:');
      console.log('  UPDATE owners SET email = $1, name = $2 WHERE "firebaseId" = $3');
      return;
    }

    // Create Owner
    const owner = await prisma.owner.create({
      data: {
        firebaseId,
        email: email || null,
        name: name || null,
      },
      include: {
        managedCompanies: { select: { id: true, companyName: true } },
        ownedCompanies: { select: { id: true, companyName: true } },
      },
    });

    console.log('✅ Owner created:');
    console.log({
      id: owner.id,
      firebaseId: owner.firebaseId,
      email: owner.email,
      name: owner.name,
      managedCompanies: owner.managedCompanies.length,
      ownedCompanies: owner.ownedCompanies.length,
    });
    console.log('');
    console.log('Next steps:');
    console.log('1. Assign CompanyHQs to this Owner (if needed)');
    console.log('2. Create SuperAdmin: node scripts/create-superadmin.js ' + (email || ''));
  } catch (error) {
    console.error('❌ Error creating Owner:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createOwner();

