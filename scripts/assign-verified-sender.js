const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG2wV8XQWmek@ep-summer-firefly-ad0yaaju-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function assignVerifiedSender() {
  const firebaseId = process.argv[2]; // Get from command line
  const email = process.argv[3];
  const name = process.argv[4] || null;

  if (!firebaseId || !email) {
    console.log('Usage: node scripts/assign-verified-sender.js <firebaseId> <email> [name]');
    console.log('\nExample:');
    console.log('  node scripts/assign-verified-sender.js gupQlyuipEY40oHtDANT6tvxYHi2 adam@example.com "Adam Cole"');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking up owner with Firebase ID: ${firebaseId}...\n`);
    
    const owner = await prisma.owners.findUnique({
      where: { firebaseId },
      select: {
        id: true,
        email: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    if (!owner) {
      console.log('❌ Owner not found!');
      process.exit(1);
    }

    console.log(`Found owner: ${owner.email}`);
    console.log(`Current verified sender: ${owner.sendgridVerifiedEmail || 'NOT SET'}\n`);

    console.log(`📝 Updating verified sender to: ${email}${name ? ` (${name})` : ''}...\n`);

    const updated = await prisma.owners.update({
      where: { id: owner.id },
      data: {
        sendgridVerifiedEmail: email,
        sendgridVerifiedName: name,
      },
      select: {
        id: true,
        email: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    console.log('✅ Successfully updated!');
    console.log(`   Owner: ${updated.email}`);
    console.log(`   Verified Email: ${updated.sendgridVerifiedEmail}`);
    console.log(`   Verified Name: ${updated.sendgridVerifiedName || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

assignVerifiedSender();

