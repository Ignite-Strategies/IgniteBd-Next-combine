/**
 * Check ALL presentations and WorkCollateral regardless of owner
 * This will help find Joel's presentation even if owner lookup fails
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllPresentations() {
  try {
    console.log('🔍 Checking ALL presentations and WorkCollateral...\n');

    // 1. Check owners table structure
    console.log('1️⃣ CHECKING OWNERS TABLE:');
    try {
      const owners = await prisma.owners.findMany({
        where: {
          OR: [
            { email: { contains: 'joel', mode: 'insensitive' } },
            { email: { contains: 'businesspoint', mode: 'insensitive' } }
          ]
        },
        take: 10
      });
      console.log(`   Found ${owners.length} owner(s) with "joel" or "businesspoint" in email\n`);
      owners.forEach((o, i) => {
        console.log(`   ${i + 1}. ${o.email} (${o.id})`);
        console.log(`      Name: ${o.name || `${o.firstName} ${o.lastName}` || 'N/A'}`);
        console.log('');
      });
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // 2. Check ALL presentations
    console.log('2️⃣ ALL PRESENTATIONS IN DATABASE:');
    try {
      // Try both model names
      let allPresentations = [];
      if (prisma.presentation) {
        allPresentations = await prisma.presentation.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      } else if (prisma.presentations) {
        allPresentations = await prisma.presentations.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      } else {
        // Try raw SQL
        allPresentations = await prisma.$queryRaw`
          SELECT * FROM "presentations"
          ORDER BY "createdAt" DESC
          LIMIT 50
        `;
      }

      console.log(`   Found ${allPresentations.length} presentation(s) total\n`);
      
      // Look for Joel-related ones
      const joelRelated = allPresentations.filter(p => {
        const presenter = (p.presenter || '').toLowerCase();
        const title = (p.title || '').toLowerCase();
        return presenter.includes('joel') || title.includes('joel') || title.includes('businesspoint');
      });

      if (joelRelated.length > 0) {
        console.log(`   🎯 Found ${joelRelated.length} potentially Joel-related presentation(s):\n`);
        joelRelated.forEach((p, i) => {
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
      } else {
        console.log('   No Joel-related presentations found\n');
      }

      // Show all presentations for reference
      if (allPresentations.length > 0) {
        console.log(`   Showing all ${allPresentations.length} presentations (most recent):\n`);
        allPresentations.forEach((p, i) => {
          const hasSlides = p.slides ? '✅' : '❌';
          console.log(`   ${i + 1}. "${p.title || 'Untitled'}"`);
          console.log(`      ID: ${p.id}`);
          console.log(`      CompanyHQ: ${p.companyHQId}`);
          console.log(`      Presenter: ${p.presenter || 'N/A'}`);
          console.log(`      Created: ${p.createdAt}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`   ❌ Error querying presentations: ${error.message}`);
      console.log(`   Available models: ${Object.keys(prisma).filter(k => !k.startsWith('$')).join(', ')}\n`);
    }

    // 3. Check ALL WorkCollateral with presentation content
    console.log('3️⃣ ALL WORKCOLLATERAL WITH PRESENTATION CONTENT:');
    try {
      const workCollateral = await prisma.work_collateral.findMany({
        where: {
          type: { in: ['PRESENTATION_DECK', 'CLE_DECK'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      console.log(`   Found ${workCollateral.length} WorkCollateral record(s) with presentation content\n`);
      
      // Look for Joel-related ones
      const joelRelated = workCollateral.filter(wc => {
        const content = wc.contentJson || {};
        const presenter = (content.presenter || '').toLowerCase();
        const title = ((content.title || wc.title || '')).toLowerCase();
        return presenter.includes('joel') || title.includes('joel') || title.includes('businesspoint');
      });

      if (joelRelated.length > 0) {
        console.log(`   🎯 Found ${joelRelated.length} potentially Joel-related presentation(s):\n`);
        joelRelated.forEach((wc, i) => {
          const content = wc.contentJson || {};
          const hasContent = wc.contentJson ? '✅' : '❌';
          const hasSlides = wc.contentJson && wc.contentJson.slides ? '✅' : '❌';
          console.log(`   ${i + 1}. "${wc.title || content.title || 'Untitled'}"`);
          console.log(`      ID: ${wc.id}`);
          console.log(`      Type: ${wc.type}`);
          console.log(`      Content: ${hasContent}`);
          console.log(`      Slides: ${hasSlides}`);
          if (content.presenter) {
            console.log(`      Presenter: ${content.presenter}`);
          }
          if (content.title) {
            console.log(`      Original Title: ${content.title}`);
          }
          console.log(`      Created: ${wc.createdAt}`);
          console.log('');
        });
      } else {
        console.log('   No Joel-related presentations found in WorkCollateral\n');
      }

      // Show all for reference
      if (workCollateral.length > 0) {
        console.log(`   Showing all ${workCollateral.length} presentation WorkCollateral (most recent):\n`);
        workCollateral.slice(0, 10).forEach((wc, i) => {
          const content = wc.contentJson || {};
          console.log(`   ${i + 1}. "${wc.title || content.title || 'Untitled'}"`);
          console.log(`      ID: ${wc.id}`);
          console.log(`      Type: ${wc.type}`);
          if (content.presenter) {
            console.log(`      Presenter: ${content.presenter}`);
          }
          console.log(`      Created: ${wc.createdAt}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`   ❌ Error querying WorkCollateral: ${error.message}\n`);
    }

    console.log('✅ Search complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPresentations();

