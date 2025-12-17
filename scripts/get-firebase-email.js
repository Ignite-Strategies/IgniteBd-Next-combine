/**
 * Get email from Firebase UID
 */
require('dotenv').config({ path: '.env.local' });
const { admin } = require('../lib/firebaseAdmin');

async function getEmail(uid) {
  try {
    const user = await admin.auth().getUser(uid);
    console.log(user.email);
    return user.email;
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/get-firebase-email.js <firebaseUid>');
  process.exit(1);
}

getEmail(uid);

