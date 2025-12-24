/**
 * Script to duplicate a presentation into a WorkItem
 * 
 * Usage: node scripts/duplicate-presentation.js
 * 
 * This script duplicates presentation cmic5u0z70001lh04ixfps3bs
 * into WorkItem cmi2l87w1000jlb048diknzxh
 */

const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required');
  console.error('   Set it in your .env.local file or export it before running this script');
  process.exit(1);
}

const prisma = new PrismaClient();

async function duplicatePresentation() {
  const originalPresentationId = 'cmic5u0z70001lh04ixfps3bs';
  const workItemId = 'cmi2l87w1000jlb048diknzxh';

  try {
    console.log('🔄 Starting presentation duplication...');
    console.log(`📋 Original Presentation ID: ${originalPresentationId}`);
    console.log(`🔗 Target WorkItem ID: ${workItemId}`);

    // Find the original presentation
    console.log('\n1️⃣ Finding original presentation...');
    const originalPresentation = await prisma.presentation.findUnique({
      where: { id: originalPresentationId },
    });

    if (!originalPresentation) {
      throw new Error(`Original presentation not found: ${originalPresentationId}`);
    }

    console.log(`✅ Found original presentation: "${originalPresentation.title}"`);
    console.log(`   CompanyHQ ID: ${originalPresentation.companyHQId}`);

    // Verify the workItem exists and get companyHQId
    console.log('\n2️⃣ Verifying WorkItem...');
    const workItem = await prisma.workPackageItem.findUnique({
      where: { id: workItemId },
      include: {
        workPackage: {
          include: {
            contact: {
              include: {
                companyHQ: true,
              },
            },
          },
        },
      },
    });

    if (!workItem) {
      throw new Error(`WorkItem not found: ${workItemId}`);
    }

    console.log(`✅ Found WorkItem: "${workItem.deliverableLabel}"`);
    console.log(`   WorkPackage: "${workItem.workPackage.title}"`);
    console.log(`   Contact: ${workItem.workPackage.contact.firstName} ${workItem.workPackage.contact.lastName}`);

    // Get companyHQId from the workItem's workPackage contact
    const companyHQId = workItem.workPackage.contact.companyHQ?.id;
    if (!companyHQId) {
      throw new Error('Could not determine companyHQId from workItem');
    }

    console.log(`   CompanyHQ ID: ${companyHQId}`);

    // Copy presentation content into WorkCollateral as a snapshot
    // DO NOT create a new Presentation - WorkCollateral contains the full snapshot
    console.log('\n3️⃣ Copying presentation content to WorkCollateral snapshot...');
    const presentationSnapshot = {
      title: originalPresentation.title,
      slides: originalPresentation.slides,
      presenter: originalPresentation.presenter,
      description: originalPresentation.description,
      feedback: {}, // Start with empty feedback object
    };

    // Create WorkCollateral entry with full content snapshot
    console.log('\n4️⃣ Creating WorkCollateral with presentation snapshot...');
    const workCollateral = await prisma.workCollateral.create({
      data: {
        workPackageItemId: workItemId,
        workPackageId: workItem.workPackageId,
        type: 'PRESENTATION_DECK',
        title: originalPresentation.title,
        contentJson: presentationSnapshot, // Full snapshot copy, not a reference
        status: 'IN_PROGRESS',
      },
    });

    console.log(`✅ Created WorkCollateral with presentation snapshot!`);
    console.log(`   WorkCollateral ID: ${workCollateral.id}`);
    console.log(`   Type: ${workCollateral.type}`);
    console.log(`   Status: ${workCollateral.status}`);
    console.log(`   Title: "${workCollateral.title}"`);

    console.log('\n✨ Duplication complete!');
    console.log('\n📊 Summary:');
    console.log(`   Original Presentation (Content Hub): ${originalPresentationId}`);
    console.log(`   WorkItem: ${workItemId}`);
    console.log(`   WorkCollateral (Client Deliverable): ${workCollateral.id}`);
    console.log(`   Content: Full snapshot copied to WorkCollateral.contentJson`);
    console.log(`\n🔗 Joel can now access the presentation at: /portal/review/cle`);

  } catch (error) {
    console.error('\n❌ Error during duplication:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
duplicatePresentation()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

