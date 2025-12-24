const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG2wV8XQWmek@ep-summer-firefly-ad0yaaju-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

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

