/**
 * Find Joel's Presentations
 * 
 * Searches the database for all presentations associated with Joel:
 * 1. Presentations in Joel's CompanyHQ(s)
 * 2. Presentations with presenter = "Joel"
 * 3. All presentations (in case they're in a different companyHQ)
 * 
 * Usage: node scripts/find-joel-presentations.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findJoelPresentations() {
  try {
    console.log('🔍 Searching for Joel\'s presentations...\n');

    // 1. Find Joel
    const joel = await prisma.owners.findFirst({
      where: { email: 'joel@businesspointlaw.com' }
    });

    if (joel) {
      console.log('✅ Found Joel:', joel.email, `(${joel.id})\n`);
      
      // Get Joel's companyHQs
      const joelMemberships = await prisma.company_memberships.findMany({
        where: { userId: joel.id },
        include: {
          company_hqs: {
            select: {
              id: true,
              companyName: true,
            }
          }
        }
      });

      console.log(`📋 Joel has ${joelMemberships.length} companyHQ(s):`);
      joelMemberships.forEach(m => {
        console.log(`   • ${m.company_hqs.companyName} (${m.company_hqs.id})`);
      });
      console.log('');

      // 2. Search presentations in Joel's companyHQs
      const joelCompanyHQIds = joelMemberships.map(m => m.company_hqs.id);
      
      if (joelCompanyHQIds.length > 0) {
        console.log('1️⃣ PRESENTATIONS IN JOEL\'S COMPANYHQS:');
        const presentationsInJoelCompanies = await prisma.presentation.findMany({
          where: {
            companyHQId: { in: joelCompanyHQIds }
          },
          orderBy: { createdAt: 'desc' },
        });

        console.log(`   Found ${presentationsInJoelCompanies.length} presentation(s)\n`);
        presentationsInJoelCompanies.forEach((p, i) => {
          const hasSlides = p.slides ? '✅' : '❌';
          const slidesInfo = p.slides 
            ? (typeof p.slides === 'object' && p.slides.sections ? `${p.slides.sections.length} sections` : 'has data')
            : 'no slides';
          console.log(`   ${i + 1}. "${p.title || 'Untitled'}"`);
          console.log(`      ID: ${p.id}`);
          console.log(`      CompanyHQ: ${p.companyHQId}`);
          console.log(`      Presenter: ${p.presenter || 'N/A'}`);
          console.log(`      Slides: ${hasSlides} ${slidesInfo}`);
          console.log(`      Created: ${p.createdAt}`);
          console.log(`      Published: ${p.published ? 'Yes' : 'No'}`);
          if (p.gammaDeckUrl) {
            console.log(`      Gamma Deck: ${p.gammaDeckUrl}`);
          }
          console.log('');
        });
      }
    } else {
      console.log('⚠️  Joel not found in database\n');
    }

    // 3. Search by presenter name "Joel"
    console.log('2️⃣ PRESENTATIONS WITH PRESENTER = "JOEL":');
    const presentationsByPresenter = await prisma.presentation.findMany({
      where: {
        presenter: { contains: 'Joel', mode: 'insensitive' }
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`   Found ${presentationsByPresenter.length} presentation(s)\n`);
    presentationsByPresenter.forEach((p, i) => {
      const hasSlides = p.slides ? '✅' : '❌';
      const slidesInfo = p.slides 
        ? (typeof p.slides === 'object' && p.slides.sections ? `${p.slides.sections.length} sections` : 'has data')
        : 'no slides';
      console.log(`   ${i + 1}. "${p.title || 'Untitled'}"`);
      console.log(`      ID: ${p.id}`);
      console.log(`      CompanyHQ: ${p.companyHQId}`);
      console.log(`      Presenter: ${p.presenter}`);
      console.log(`      Slides: ${hasSlides} ${slidesInfo}`);
      console.log(`      Created: ${p.createdAt}`);
      console.log('');
    });

    // 4. Show ALL presentations (in case it's in a different companyHQ)
    console.log('3️⃣ ALL PRESENTATIONS IN DATABASE:');
    const allPresentations = await prisma.presentation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to most recent 50
    });

    console.log(`   Found ${allPresentations.length} presentation(s) (showing most recent 50)\n`);
    allPresentations.forEach((p, i) => {
      const hasSlides = p.slides ? '✅' : '❌';
      const slidesInfo = p.slides 
        ? (typeof p.slides === 'object' && p.slides.sections ? `${p.slides.sections.length} sections` : 'has data')
        : 'no slides';
      console.log(`   ${i + 1}. "${p.title || 'Untitled'}"`);
      console.log(`      ID: ${p.id}`);
      console.log(`      CompanyHQ: ${p.companyHQId}`);
      console.log(`      Presenter: ${p.presenter || 'N/A'}`);
      console.log(`      Slides: ${hasSlides} ${slidesInfo}`);
      console.log(`      Created: ${p.createdAt}`);
      console.log('');
    });

    // 5. Check WorkCollateral for presentation snapshots
    console.log('4️⃣ WORKCOLLATERAL WITH PRESENTATION CONTENT:');
    const workCollateral = await prisma.workCollateral.findMany({
      where: {
        type: { in: ['PRESENTATION_DECK', 'CLE_DECK'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`   Found ${workCollateral.length} WorkCollateral record(s)\n`);
    workCollateral.forEach((wc, i) => {
      const hasContent = wc.contentJson ? '✅' : '❌';
      const hasSlides = wc.contentJson && wc.contentJson.slides ? '✅' : '❌';
      console.log(`   ${i + 1}. "${wc.title || 'Untitled'}"`);
      console.log(`      ID: ${wc.id}`);
      console.log(`      Type: ${wc.type}`);
      console.log(`      Content: ${hasContent}`);
      console.log(`      Slides: ${hasSlides}`);
      if (wc.contentJson && wc.contentJson.title) {
        console.log(`      Original Title: ${wc.contentJson.title}`);
      }
      if (wc.contentJson && wc.contentJson.presenter) {
        console.log(`      Presenter: ${wc.contentJson.presenter}`);
      }
      console.log(`      Created: ${wc.createdAt}`);
      console.log('');
    });

    console.log('✅ Search complete!');
    console.log('\n💡 TIP: If you found a presentation ID, you can view it at:');
    console.log('   /content/presentations/[id]');
    console.log('   Or query it directly: node -e "const {PrismaClient} = require(\'@prisma/client\'); const p = new PrismaClient(); p.presentation.findUnique({where: {id: \'YOUR_ID\'}}).then(console.log).finally(() => p.$disconnect());"');

  } catch (error) {
    console.error('❌ Error searching for presentations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

findJoelPresentations();

