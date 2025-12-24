const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required');
  console.error('   Set it in your .env.local file or export it before running this script');
  process.exit(1);
}

const prisma = new PrismaClient();

async function checkVerifiedSenders() {
  try {
    console.log('🔍 Checking owners table for verified senders...\n');
    
    const owners = await prisma.owners.findMany({
      select: {
        id: true,
        email: true,
        firebaseId: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 20
    });

    console.log(`Found ${owners.length} owners:\n`);
    
    owners.forEach((owner, idx) => {
      console.log(`${idx + 1}. Owner ID: ${owner.id}`);
      console.log(`   Email: ${owner.email || 'N/A'}`);
      console.log(`   Firebase ID: ${owner.firebaseId || 'N/A'}`);
      console.log(`   ✅ Verified Email: ${owner.sendgridVerifiedEmail || 'NOT SET'}`);
      console.log(`   ✅ Verified Name: ${owner.sendgridVerifiedName || 'NOT SET'}`);
      console.log('');
    });

    const withVerified = owners.filter(o => o.sendgridVerifiedEmail);
    console.log(`\n📊 Summary: ${withVerified.length} out of ${owners.length} owners have verified senders`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVerifiedSenders();

