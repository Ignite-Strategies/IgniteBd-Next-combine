/**
 * Check Database for Presentations
 * 
 * Queries the database to see:
 * 1. How many presentations exist
 * 2. What companyHQIds they belong to
 * 3. WorkCollateral records with presentation types
 * 4. Any relationships between them
 * 
 * Usage: node scripts/check-db-presentations.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Checking database for presentations...\n');

    // 1. Check Presentation table
    console.log('1️⃣ PRESENTATION TABLE:');
    const presentations = await prisma.presentation.findMany({
      select: {
        id: true,
        companyHQId: true,
        title: true,
        slides: true,
        presenter: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`   Found ${presentations.length} presentations`);
    if (presentations.length > 0) {
      console.log('\n   Presentations:');
      presentations.forEach((p, i) => {
        const hasSlides = p.slides ? '✅' : '❌';
        const slidesInfo = p.slides 
          ? (typeof p.slides === 'object' && p.slides.sections ? `${p.slides.sections.length} sections` : 'has data')
          : 'no slides';
        console.log(`   ${i + 1}. ${p.title || 'Untitled'}`);
        console.log(`      ID: ${p.id}`);
        console.log(`      CompanyHQ: ${p.companyHQId}`);
        console.log(`      Slides: ${hasSlides} ${slidesInfo}`);
        console.log(`      Created: ${p.createdAt}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  No presentations found in database\n');
    }

    // 2. Check WorkCollateral with presentation types
    console.log('2️⃣ WORKCOLLATERAL TABLE (PRESENTATION_DECK / CLE_DECK):');
    const workCollateral = await prisma.workCollateral.findMany({
      where: {
        type: { in: ['PRESENTATION_DECK', 'CLE_DECK'] },
      },
      select: {
        id: true,
        type: true,
        title: true,
        workPackageItemId: true,
        contentJson: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`   Found ${workCollateral.length} WorkCollateral records`);
    if (workCollateral.length > 0) {
      console.log('\n   WorkCollateral:');
      workCollateral.forEach((wc, i) => {
        const hasContentJson = wc.contentJson ? '✅' : '❌';
        console.log(`   ${i + 1}. ${wc.title || 'Untitled'}`);
        console.log(`      ID: ${wc.id}`);
        console.log(`      Type: ${wc.type}`);
        console.log(`      WorkPackageItemId: ${wc.workPackageItemId || 'none'}`);
        console.log(`      ContentJson: ${hasContentJson}`);
        if (wc.contentJson && typeof wc.contentJson === 'object') {
          const hasSlides = wc.contentJson.slides ? '✅' : '❌';
          const slidesInfo = wc.contentJson.slides 
            ? (wc.contentJson.slides.sections ? `${wc.contentJson.slides.sections.length} sections` : 'has data')
            : 'no slides';
          console.log(`      ContentJson.slides: ${hasSlides} ${slidesInfo}`);
        }
        console.log(`      Created: ${wc.createdAt}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  No WorkCollateral with presentation types found\n');
    }

    // 3. Check CompanyHQ to see what companyHQIds exist
    console.log('3️⃣ COMPANYHQ TABLE:');
    const companyHQs = await prisma.companyHQ.findMany({
      select: {
        id: true,
        companyName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log(`   Found ${companyHQs.length} companies`);
    if (companyHQs.length > 0) {
      console.log('\n   Companies:');
      companyHQs.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.companyName || 'Unnamed'}`);
        console.log(`      ID: ${c.id}`);
        console.log('');
      });
    }

    // 4. Check if any WorkCollateral references presentations
    console.log('4️⃣ WORKCOLLATERAL → PRESENTATION LINKS:');
    const linkedCollateral = await prisma.workCollateral.findMany({
      where: {
        presentationId: { not: null },
      },
      select: {
        id: true,
        type: true,
        title: true,
        presentationId: true,
        presentation: {
          select: {
            id: true,
            title: true,
            companyHQId: true,
          },
        },
      },
    });

    console.log(`   Found ${linkedCollateral.length} WorkCollateral records linked to Presentations`);
    if (linkedCollateral.length > 0) {
      linkedCollateral.forEach((wc, i) => {
        console.log(`   ${i + 1}. WorkCollateral: ${wc.title || 'Untitled'}`);
        console.log(`      → Presentation: ${wc.presentation?.title || 'Unknown'} (${wc.presentationId})`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  No WorkCollateral records are linked to Presentation model\n');
    }

    console.log('✅ Database check complete!');

  } catch (error) {
    console.error('❌ Error checking database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

