/**
 * Update Joel's Firebase ID to the real one
 * Run: node scripts/update-joel-firebase-id.js
 * 
 * This script updates Joel's Firebase ID from placeholder to real Firebase ID
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JOEL_REAL_FIREBASE_ID = 'Nwbu8tYrwTXZQpUq6YrkEFAg58O2';
const JOEL_EMAIL = 'joel@businesspointlaw.com';

async function updateJoelFirebaseId() {
  try {
    console.log('🔧 Updating Joel\'s Firebase ID...\n');

    // Find Joel
    const joel = await prisma.owners.findFirst({
      where: { email: JOEL_EMAIL }
    });

    if (!joel) {
      console.log(`❌ Joel not found with email: ${JOEL_EMAIL}`);
      console.log('💡 Run seed-joel-companyhq.js first to create Joel');
      process.exit(1);
    }

    console.log(`✅ Found Joel: ${joel.email} (${joel.id})`);
    console.log(`   Current Firebase ID: ${joel.firebaseId}`);
    console.log(`   Target Firebase ID: ${JOEL_REAL_FIREBASE_ID}`);

    if (joel.firebaseId === JOEL_REAL_FIREBASE_ID) {
      console.log('\n✅ Joel already has the correct Firebase ID!');
      return;
    }

    // Check if the target Firebase ID is already in use by another owner
    const existingOwner = await prisma.owners.findUnique({
      where: { firebaseId: JOEL_REAL_FIREBASE_ID }
    });

    if (existingOwner) {
      if (existingOwner.id === joel.id) {
        console.log('\n✅ Firebase ID already belongs to Joel');
        return;
      } else {
        console.log(`\n⚠️  Warning: Firebase ID ${JOEL_REAL_FIREBASE_ID} is already in use by another owner:`);
        console.log(`   Owner ID: ${existingOwner.id}`);
        console.log(`   Email: ${existingOwner.email}`);
        console.log('\n❌ Cannot update - Firebase ID must be unique');
        process.exit(1);
      }
    }

    // Update Joel's Firebase ID
    console.log('\n🔄 Updating Firebase ID...');
    const updatedJoel = await prisma.owners.update({
      where: { id: joel.id },
      data: { firebaseId: JOEL_REAL_FIREBASE_ID }
    });

    console.log(`✅ Successfully updated Joel's Firebase ID!`);
    console.log(`   Old: ${joel.firebaseId}`);
    console.log(`   New: ${updatedJoel.firebaseId}`);

    // Verify the update
    const verifyJoel = await prisma.owners.findUnique({
      where: { id: joel.id }
    });

    console.log('\n✅ Verification:');
    console.log(`   Joel ID: ${verifyJoel.id}`);
    console.log(`   Email: ${verifyJoel.email}`);
    console.log(`   Firebase ID: ${verifyJoel.firebaseId}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error.code === 'P2002') {
      console.error('   This Firebase ID is already in use by another owner');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateJoelFirebaseId();






