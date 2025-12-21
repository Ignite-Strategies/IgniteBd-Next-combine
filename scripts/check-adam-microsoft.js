import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdamMicrosoft() {
  console.log('🔍 Checking Adam Cole\'s Microsoft connection status...\n');

  try {
    // Find Adam's owner record
    const owner = await prisma.owners.findFirst({
      where: {
        OR: [
          { email: { contains: 'adam', mode: 'insensitive' } },
          { firstName: { contains: 'Adam', mode: 'insensitive' } },
          { lastName: { contains: 'Cole', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        firebaseId: true,
        microsoftAccessToken: true,
        microsoftRefreshToken: true,
        microsoftExpiresAt: true,
        microsoftEmail: true,
        microsoftDisplayName: true,
        microsoftTenantId: true,
      }
    });

    if (!owner) {
      console.log('❌ No owner found matching Adam Cole');
      return;
    }

    console.log('📋 Owner Record:');
    console.log(`  ID: ${owner.id}`);
    console.log(`  Email: ${owner.email}`);
    console.log(`  Name: ${owner.firstName} ${owner.lastName}`);
    console.log(`  Firebase ID: ${owner.firebaseId}`);
    console.log('');

    console.log('🔐 Microsoft OAuth Fields:');
    console.log(`  microsoftAccessToken: ${owner.microsoftAccessToken ? '✅ EXISTS' : '❌ NULL'}`);
    console.log(`  microsoftRefreshToken: ${owner.microsoftRefreshToken ? '✅ EXISTS' : '❌ NULL'}`);
    console.log(`  microsoftExpiresAt: ${owner.microsoftExpiresAt || 'NULL'}`);
    console.log(`  microsoftEmail: ${owner.microsoftEmail || 'NULL'}`);
    console.log(`  microsoftDisplayName: ${owner.microsoftDisplayName || 'NULL'}`);
    console.log(`  microsoftTenantId: ${owner.microsoftTenantId || 'NULL'}`);
    console.log('');

    // Check connection status
    const now = new Date();
    const expiresAt = owner.microsoftExpiresAt ? new Date(owner.microsoftExpiresAt) : null;
    
    const hasAccessToken = !!owner.microsoftAccessToken;
    const hasRefreshToken = !!owner.microsoftRefreshToken;
    const hasExpiresAt = !!expiresAt;
    const isNotExpired = expiresAt ? expiresAt > now : false;

    console.log('🔍 Connection Status Check:');
    console.log(`  Has Access Token: ${hasAccessToken ? '✅' : '❌'}`);
    console.log(`  Has Refresh Token: ${hasRefreshToken ? '✅' : '❌'}`);
    console.log(`  Has Expires At: ${hasExpiresAt ? '✅' : '❌'}`);
    if (expiresAt) {
      console.log(`  Expires At: ${expiresAt.toISOString()}`);
      console.log(`  Current Time: ${now.toISOString()}`);
      console.log(`  Is Expired: ${isNotExpired ? '❌ YES (expired)' : '✅ NO (valid)'}`);
    }
    console.log('');

    const microsoftConnected = !!(
      owner.microsoftAccessToken &&
      owner.microsoftRefreshToken &&
      expiresAt &&
      expiresAt > now
    );

    console.log('🎯 Final Status:');
    console.log(`  microsoftConnected: ${microsoftConnected ? '✅ TRUE' : '❌ FALSE'}`);
    console.log('');

    if (!microsoftConnected) {
      console.log('⚠️  Why NOT connected:');
      if (!hasAccessToken) console.log('  - Missing microsoftAccessToken');
      if (!hasRefreshToken) console.log('  - Missing microsoftRefreshToken');
      if (!hasExpiresAt) console.log('  - Missing microsoftExpiresAt');
      if (hasExpiresAt && isNotExpired) console.log('  - Token is expired');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdamMicrosoft();

