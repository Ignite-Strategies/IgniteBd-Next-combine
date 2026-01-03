/**
 * Find Joel's Presentation - Check ALL Possible Locations
 * 
 * Searches for Joel's presentation in:
 * 1. presentations table (current system)
 * 2. deck_artifacts table (old artifacts system)
 * 3. WorkCollateral table (snapshot storage)
 * 4. localStorage (if running in browser context)
 * 
 * Usage: node scripts/find-joel-presentation-all-locations.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findJoelPresentation() {
  try {
    console.log('🔍 Searching for Joel\'s presentation in ALL possible locations...\n');

    // 1. Find Joel
    const joel = await prisma.owners.findFirst({
      where: { email: 'joel@businesspointlaw.com' }
    });

    if (!joel) {
      console.log('⚠️  Joel not found in database\n');
      console.log('Checking other locations anyway...\n');
    } else {
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

      const joelCompanyHQIds = joelMemberships.map(m => m.company_hqs.id);

      // 1️⃣ Check presentations table
      console.log('1️⃣ PRESENTATIONS TABLE (current system):');
      if (joelCompanyHQIds.length > 0) {
        try {
          // Try both singular and plural model names
          let presentations = [];
          if (prisma.presentation) {
            presentations = await prisma.presentation.findMany({
              where: {
                companyHQId: { in: joelCompanyHQIds }
              },
              orderBy: { createdAt: 'desc' },
            });
          } else if (prisma.presentations) {
            presentations = await prisma.presentations.findMany({
              where: {
                companyHQId: { in: joelCompanyHQIds }
              },
              orderBy: { createdAt: 'desc' },
            });
          }

          console.log(`   Found ${presentations.length} presentation(s)\n`);
          presentations.forEach((p, i) => {
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
        } catch (error) {
          console.log(`   ❌ Error querying presentations: ${error.message}`);
          console.log(`   Available models: ${Object.keys(prisma).filter(k => !k.startsWith('$')).join(', ')}\n`);
        }
      }

      // 2️⃣ Check deck_artifacts table (old artifacts system)
      console.log('2️⃣ DECK_ARTIFACTS TABLE (old artifacts system - might have been deleted):');
      try {
        // Try to query deck_artifacts directly via raw SQL
        const deckArtifacts = await prisma.$queryRaw`
          SELECT * FROM "deck_artifacts" 
          WHERE "companyHQId" = ANY(${joelCompanyHQIds})
          ORDER BY "createdAt" DESC
        `;
        
        console.log(`   Found ${deckArtifacts.length} deck artifact(s)\n`);
        deckArtifacts.forEach((da, i) => {
          console.log(`   ${i + 1}. "${da.title || 'Untitled'}"`);
          console.log(`      ID: ${da.id}`);
          console.log(`      CompanyHQ: ${da.companyHQId}`);
          console.log(`      Status: ${da.status || 'N/A'}`);
          console.log(`      Has Outline: ${da.outlineJson ? '✅' : '❌'}`);
          console.log(`      Has Blob: ${da.blobText ? '✅' : '❌'}`);
          console.log(`      File URL: ${da.fileUrl || 'N/A'}`);
          console.log(`      Created: ${da.createdAt}`);
          console.log('');
        });
      } catch (error) {
        if (error.message.includes('does not exist') || error.message.includes('relation') || error.message.includes('table')) {
          console.log('   ⚠️  deck_artifacts table does not exist (might have been dropped)\n');
        } else {
          console.log(`   ❌ Error querying deck_artifacts: ${error.message}\n`);
        }
      }

      // 3️⃣ Check WorkCollateral for presentation snapshots
      console.log('3️⃣ WORKCOLLATERAL TABLE (presentation snapshots):');
      try {
        const workCollateral = await prisma.workCollateral.findMany({
          where: {
            type: { in: ['PRESENTATION_DECK', 'CLE_DECK'] }
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        console.log(`   Found ${workCollateral.length} WorkCollateral record(s) with presentation content\n`);
        
        // Filter for ones that might be Joel's
        const joelRelated = workCollateral.filter(wc => {
          const content = wc.contentJson || {};
          const presenter = content.presenter || '';
          const title = content.title || wc.title || '';
          return presenter.toLowerCase().includes('joel') || 
                 title.toLowerCase().includes('joel') ||
                 title.toLowerCase().includes('businesspoint');
        });

        if (joelRelated.length > 0) {
          console.log(`   🎯 Found ${joelRelated.length} potentially Joel-related presentation(s):\n`);
          joelRelated.forEach((wc, i) => {
            const hasContent = wc.contentJson ? '✅' : '❌';
            const hasSlides = wc.contentJson && wc.contentJson.slides ? '✅' : '❌';
            const content = wc.contentJson || {};
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

        // Show all presentation WorkCollateral for reference
        if (workCollateral.length > 0 && joelRelated.length === 0) {
          console.log(`   Showing all ${workCollateral.length} presentation WorkCollateral (most recent):\n`);
          workCollateral.slice(0, 5).forEach((wc, i) => {
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

      // 4️⃣ Check ALL presentations (in case it's in a different companyHQ)
      console.log('4️⃣ ALL PRESENTATIONS IN DATABASE (checking all companyHQs):');
      try {
        let allPresentations = [];
        if (prisma.presentation) {
          allPresentations = await prisma.presentation.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
        } else if (prisma.presentations) {
          allPresentations = await prisma.presentations.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
        }

        console.log(`   Found ${allPresentations.length} presentation(s) (showing most recent 20)\n`);
        allPresentations.forEach((p, i) => {
          const hasSlides = p.slides ? '✅' : '❌';
          const slidesInfo = p.slides 
            ? (typeof p.slides === 'object' && p.slides.sections ? `${p.slides.sections.length} sections` : 'has data')
            : 'no slides';
          const isJoel = (p.presenter || '').toLowerCase().includes('joel');
          const marker = isJoel ? '🎯' : '  ';
          console.log(`${marker} ${i + 1}. "${p.title || 'Untitled'}"`);
          console.log(`      ID: ${p.id}`);
          console.log(`      CompanyHQ: ${p.companyHQId}`);
          console.log(`      Presenter: ${p.presenter || 'N/A'}`);
          console.log(`      Slides: ${hasSlides} ${slidesInfo}`);
          console.log(`      Created: ${p.createdAt}`);
          console.log('');
        });
      } catch (error) {
        console.log(`   ❌ Error querying all presentations: ${error.message}\n`);
      }
    }

    // 5️⃣ Check if deck_artifacts table exists at all
    console.log('5️⃣ CHECKING IF DECK_ARTIFACTS TABLE EXISTS:');
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'deck_artifacts'
        );
      `;
      const exists = tableExists[0]?.exists || false;
      if (exists) {
        console.log('   ✅ deck_artifacts table EXISTS\n');
        
        // Count records
        const count = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "deck_artifacts"
        `;
        console.log(`   Total records in deck_artifacts: ${count[0]?.count || 0}\n`);
      } else {
        console.log('   ❌ deck_artifacts table DOES NOT EXIST (was likely dropped)\n');
      }
    } catch (error) {
      console.log(`   ❌ Error checking table existence: ${error.message}\n`);
    }

    console.log('✅ Search complete!');
    console.log('\n💡 TIP: If you found a presentation ID, you can view it at:');
    console.log('   /content/presentations/[id]');
    console.log('\n💡 If the presentation was in deck_artifacts and got deleted,');
    console.log('   it might be recoverable from database backups or logs.');

  } catch (error) {
    console.error('❌ Error searching for presentations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

findJoelPresentation();

