/**
 * Check Blogs Wiring and Data
 * 
 * Verifies:
 * 1. Blogs table exists and has data
 * 2. API routes exist and work
 * 3. Frontend pages exist
 * 4. Hydration includes blogs
 * 5. Compare to presentations to see what's missing
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function checkBlogsWiring() {
  try {
    console.log('🔍 Checking Blogs Wiring and Data...\n');

    // 1. Check database - blogs table
    console.log('1️⃣ DATABASE - Blogs Table:');
    try {
      const blogs = await prisma.blogs.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      console.log(`   ✅ blogs table exists`);
      console.log(`   Found ${blogs.length} blog(s) in database\n`);
      
      if (blogs.length > 0) {
        blogs.forEach((b, i) => {
          console.log(`   ${i + 1}. "${b.title || 'Untitled'}"`);
          console.log(`      ID: ${b.id}`);
          console.log(`      CompanyHQ: ${b.companyHQId}`);
          console.log(`      Has Text: ${b.blogText ? '✅' : '❌'}`);
          console.log(`      Has Sections: ${b.sections ? '✅' : '❌'}`);
          console.log(`      Created: ${b.createdAt}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // 2. Check API routes
    console.log('2️⃣ API ROUTES:');
    const apiRoutes = [
      'app/api/content/blog/route.js',
      'app/api/content/blog/[id]/route.js',
    ];
    
    apiRoutes.forEach(route => {
      const fullPath = path.join(process.cwd(), route);
      if (fs.existsSync(fullPath)) {
        console.log(`   ✅ ${route} exists`);
      } else {
        console.log(`   ❌ ${route} MISSING`);
      }
    });
    console.log('');

    // 3. Check frontend pages
    console.log('3️⃣ FRONTEND PAGES:');
    const frontendPages = [
      'app/(authenticated)/content/blog/page.tsx',
      'app/(authenticated)/content/blog/[id]/edit/page.tsx',
      'app/(authenticated)/content/blog/build/write/page.tsx',
      'app/(authenticated)/builder/blog/[blogId]/page.jsx',
    ];
    
    frontendPages.forEach(page => {
      const fullPath = path.join(process.cwd(), page);
      if (fs.existsSync(fullPath)) {
        console.log(`   ✅ ${page} exists`);
      } else {
        console.log(`   ❌ ${page} MISSING`);
      }
    });
    console.log('');

    // 4. Check hydration endpoint
    console.log('4️⃣ HYDRATION ENDPOINT:');
    const hydrateRoute = 'app/api/company/hydrate/route.js';
    const hydratePath = path.join(process.cwd(), hydrateRoute);
    if (fs.existsSync(hydratePath)) {
      const content = fs.readFileSync(hydratePath, 'utf8');
      if (content.includes('blogs') || content.includes('blog')) {
        console.log(`   ✅ ${hydrateRoute} includes blogs`);
        // Check if it's properly implemented
        if (content.includes('prisma.blogs.findMany')) {
          console.log(`   ✅ Blogs query exists in hydrate`);
        } else {
          console.log(`   ⚠️  Blogs query might be missing`);
        }
      } else {
        console.log(`   ❌ ${hydrateRoute} does NOT include blogs`);
      }
    } else {
      console.log(`   ❌ ${hydrateRoute} MISSING`);
    }
    console.log('');

    // 5. Compare to presentations
    console.log('5️⃣ COMPARISON TO PRESENTATIONS:');
    console.log('   Checking if blogs have same wiring as presentations...\n');
    
    // Check presentations API
    const presentationsApi = 'app/api/content/presentations/route.js';
    const blogsApi = 'app/api/content/blog/route.js';
    
    const presApiExists = fs.existsSync(path.join(process.cwd(), presentationsApi));
    const blogsApiExists = fs.existsSync(path.join(process.cwd(), blogsApi));
    
    console.log(`   Presentations API: ${presApiExists ? '✅' : '❌'}`);
    console.log(`   Blogs API: ${blogsApiExists ? '✅' : '❌'}`);
    
    // Check frontend pages
    const presPage = 'app/(authenticated)/content/presentations/page.jsx';
    const blogsPage = 'app/(authenticated)/content/blog/page.tsx';
    
    const presPageExists = fs.existsSync(path.join(process.cwd(), presPage));
    const blogsPageExists = fs.existsSync(path.join(process.cwd(), blogsPage));
    
    console.log(`   Presentations Page: ${presPageExists ? '✅' : '❌'}`);
    console.log(`   Blogs Page: ${blogsPageExists ? '✅' : '❌'}`);
    
    // Check database counts
    try {
      const presCount = await prisma.presentation ? 
        (await prisma.presentation.count()) : 
        (await prisma.$queryRaw`SELECT COUNT(*) as count FROM "presentations"`)[0]?.count || 0;
      const blogsCount = await prisma.blogs.count();
      
      console.log(`   Presentations in DB: ${presCount}`);
      console.log(`   Blogs in DB: ${blogsCount}`);
    } catch (error) {
      console.log(`   ⚠️  Could not count: ${error.message}`);
    }
    console.log('');

    // 6. Check for old artifacts system references
    console.log('6️⃣ OLD ARTIFACTS SYSTEM:');
    const builderBlogPath = path.join(process.cwd(), 'app/(authenticated)/builder/blog/[blogId]/page.jsx');
    if (fs.existsSync(builderBlogPath)) {
      const content = fs.readFileSync(builderBlogPath, 'utf8');
      if (content.includes('artifacts') || content.includes('Artifacts system removed')) {
        console.log(`   ⚠️  Builder page has artifacts system references (might need rewiring)`);
      } else {
        console.log(`   ✅ Builder page looks clean`);
      }
    }
    console.log('');

    console.log('✅ Check complete!');
    console.log('\n💡 SUMMARY:');
    console.log('   - Check if blogs are missing data (like presentations)');
    console.log('   - Verify all API routes are wired correctly');
    console.log('   - Ensure hydration includes blogs');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkBlogsWiring();

