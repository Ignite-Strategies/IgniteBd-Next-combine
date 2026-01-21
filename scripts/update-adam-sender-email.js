/**
 * Script to update Adam's owner record with SendGrid verified sender email
 * Run: node scripts/update-adam-sender-email.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAdamSenderEmail() {
  try {
    console.log('🔍 Looking for Adam\'s owner record...');
    
    // Find Adam's owner by email
    const adamOwner = await prisma.owners.findFirst({
      where: {
        OR: [
          { email: { contains: 'adam', mode: 'insensitive' } },
          { email: { contains: 'ignitestrategies', mode: 'insensitive' } },
        ],
      },
    });

    if (!adamOwner) {
      console.log('❌ Could not find Adam\'s owner record');
      console.log('Available owners:');
      const allOwners = await prisma.owners.findMany({
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      console.log(JSON.stringify(allOwners, null, 2));
      return;
    }

    console.log(`✅ Found owner: ${adamOwner.email} (${adamOwner.id})`);

    // Update with SendGrid verified sender info
    const updated = await prisma.owners.update({
      where: { id: adamOwner.id },
      data: {
        sendgridVerifiedEmail: 'adam@ignitestrategies.co',
        sendgridVerifiedName: 'Adam Cole',
      },
    });

    console.log('✅ Updated Adam\'s sender email:');
    console.log(`   Email: ${updated.sendgridVerifiedEmail}`);
    console.log(`   Name: ${updated.sendgridVerifiedName}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdamSenderEmail();




