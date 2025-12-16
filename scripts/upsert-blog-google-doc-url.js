/**
 * Script to upsert a blog with googleDocUrl
 * Usage: node scripts/upsert-blog-google-doc-url.js <blogId> <googleDocUrl>
 * Or: node scripts/upsert-blog-google-doc-url.js --list (to list all blogs)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    // List all blogs
    const blogs = await prisma.blogs.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        googleDocUrl: true,
        createdAt: true,
      },
    });

    console.log(`\nFound ${blogs.length} blog(s):\n`);
    blogs.forEach((blog) => {
      console.log(`ID: ${blog.id}`);
      console.log(`Title: ${blog.title}`);
      console.log(`Google Doc URL: ${blog.googleDocUrl || '(not set)'}`);
      console.log(`Created: ${blog.createdAt}`);
      console.log('---');
    });
    return;
  }

  const [blogId, googleDocUrl] = args;

  if (!blogId) {
    console.error('Error: Blog ID is required');
    console.log('\nUsage:');
    console.log('  node scripts/upsert-blog-google-doc-url.js <blogId> <googleDocUrl>');
    console.log('  node scripts/upsert-blog-google-doc-url.js --list');
    process.exit(1);
  }

  try {
    // Check if blog exists
    const existing = await prisma.blogs.findUnique({
      where: { id: blogId },
    });

    if (!existing) {
      console.error(`❌ Blog with ID ${blogId} not found`);
      console.log('\nRun with --list to see available blogs');
      process.exit(1);
    }

    // Upsert: update with googleDocUrl if provided, otherwise just show current state
    if (googleDocUrl) {
      const updated = await prisma.blogs.update({
        where: { id: blogId },
        data: { googleDocUrl },
      });
      console.log(`✅ Updated blog: ${updated.title}`);
      console.log(`   Google Doc URL: ${updated.googleDocUrl}`);
    } else {
      // Just show current state
      console.log(`\nCurrent blog state:`);
      console.log(`   ID: ${existing.id}`);
      console.log(`   Title: ${existing.title}`);
      console.log(`   Google Doc URL: ${existing.googleDocUrl || '(not set)'}`);
      console.log(`\nTo update, provide a Google Doc URL:`);
      console.log(`   node scripts/upsert-blog-google-doc-url.js ${blogId} <googleDocUrl>`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
