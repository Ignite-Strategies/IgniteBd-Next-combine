/**
 * Fix Presentation companyHQId
 * 
 * Updates presentations to use the correct companyHQId
 * 
 * Usage: node scripts/fix-presentation-companyhqid.js <targetCompanyHQId>
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixPresentationCompanyHQId(targetCompanyHQId) {
  try {
    if (!targetCompanyHQId) {
      console.error('❌ Error: targetCompanyHQId is required');
      console.log('Usage: node scripts/fix-presentation-companyhqid.js <targetCompanyHQId>');
      process.exit(1);
    }

    console.log('🔍 Checking presentations...\n');

    // Find all presentations
    const presentations = await prisma.presentation.findMany({
      select: {
        id: true,
        companyHQId: true,
        title: true,
      },
    });

    console.log(`Found ${presentations.length} presentations:`);
    presentations.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title || 'Untitled'}`);
      console.log(`     ID: ${p.id}`);
      console.log(`     Current companyHQId: ${p.companyHQId}`);
      console.log('');
    });

    // Find presentations that need updating
    const toUpdate = presentations.filter(p => p.companyHQId !== targetCompanyHQId);

    if (toUpdate.length === 0) {
      console.log('✅ All presentations already have the correct companyHQId');
      return;
    }

    console.log(`\n📝 Found ${toUpdate.length} presentations to update:`);
    toUpdate.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title || 'Untitled'} (${p.id})`);
      console.log(`     ${p.companyHQId} → ${targetCompanyHQId}`);
    });

    console.log(`\n🔄 Updating presentations to companyHQId: ${targetCompanyHQId}...`);

    const result = await prisma.presentation.updateMany({
      where: {
        id: { in: toUpdate.map(p => p.id) },
      },
      data: {
        companyHQId: targetCompanyHQId,
      },
    });

    console.log(`✅ Updated ${result.count} presentations`);

    // Verify
    const updated = await prisma.presentation.findMany({
      where: {
        companyHQId: targetCompanyHQId,
      },
      select: {
        id: true,
        title: true,
        companyHQId: true,
      },
    });

    console.log(`\n✅ Verification: ${updated.length} presentations now have companyHQId: ${targetCompanyHQId}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const targetCompanyHQId = process.argv[2];
fixPresentationCompanyHQId(targetCompanyHQId);

