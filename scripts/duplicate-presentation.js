/**
 * Script to duplicate a presentation into a WorkItem
 * 
 * Usage: node scripts/duplicate-presentation.js
 * 
 * This script duplicates presentation cmic5u0z70001lh04ixfps3bs
 * into WorkItem cmi2l87w1000jlb048diknzxh
 */

const { PrismaClient } = require('@prisma/client');

// DATABASE_URL from env.rtf
const DATABASE_URL = 'postgresql://ignitedb_ef0c_user:HeBA6pylnkfG2HCgBtz1FZVWflq8SF9J@dpg-d3sdl46uk2gs73c5f0ig-a.oregon-postgres.render.com/ignitedb_ef0c';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

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

    // Create the duplicated presentation
    console.log('\n3️⃣ Creating duplicated presentation...');
    const joelClePresentation = await prisma.presentation.create({
      data: {
        companyHQId,
        title: originalPresentation.title,
        slides: originalPresentation.slides,
        presenter: originalPresentation.presenter,
        description: originalPresentation.description,
        feedback: null, // Start with empty feedback
        published: false,
        publishedAt: null,
      },
    });

    console.log(`✅ Created duplicated presentation!`);
    console.log(`   New Presentation ID: ${joelClePresentation.id}`);
    console.log(`   Title: "${joelClePresentation.title}"`);
    console.log(`   Created at: ${joelClePresentation.createdAt}`);

    // Create WorkCollateral entry to link presentation to WorkItem
    console.log('\n4️⃣ Creating WorkCollateral link...');
    const workCollateral = await prisma.workCollateral.create({
      data: {
        workPackageItemId: workItemId,
        workPackageId: workItem.workPackageId,
        type: 'CLE_DECK',
        title: joelClePresentation.title,
        contentJson: {
          presentationId: joelClePresentation.id,
          type: 'presentation',
        },
        status: 'IN_REVIEW',
      },
    });

    console.log(`✅ Created WorkCollateral!`);
    console.log(`   WorkCollateral ID: ${workCollateral.id}`);
    console.log(`   Type: ${workCollateral.type}`);
    console.log(`   Status: ${workCollateral.status}`);

    console.log('\n✨ Duplication complete!');
    console.log('\n📊 Summary:');
    console.log(`   Original Presentation: ${originalPresentationId}`);
    console.log(`   New Presentation (joelClePresentation): ${joelClePresentation.id}`);
    console.log(`   WorkItem: ${workItemId}`);
    console.log(`   WorkCollateral: ${workCollateral.id}`);
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

