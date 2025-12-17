/**
 * Script to upsert a blog with googleDocUrl
 * Usage: 
 *   node scripts/upsert-blog-google-doc-url.js <blogId> <googleDocUrl>
 *   node scripts/upsert-blog-google-doc-url.js <blogId> --export (export to Google Docs first)
 *   node scripts/upsert-blog-google-doc-url.js --list (to list all blogs)
 */

import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

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

    let finalGoogleDocUrl = googleDocUrl;

    // If --export flag, create Google Doc first
    if (googleDocUrl === '--export') {
      console.log('🔄 Exporting blog to Google Docs...');
      
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (!serviceAccountJson) {
        console.error('❌ Error: GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');
        process.exit(1);
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      const auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      await auth.authorize();

      const drive = google.drive({ version: 'v3', auth });
      const docs = google.docs({ version: 'v1', auth });

      const documentTitle = existing.title || 'Untitled Blog';
      
      // Build full text content
      let fullText = '';
      let titleStart = 1;
      let titleEnd = 1;
      
      fullText += documentTitle + '\n';
      titleEnd = documentTitle.length + 1;
      
      if (existing.subtitle) {
        fullText += existing.subtitle + '\n\n';
      } else {
        fullText += '\n';
      }
      
      if (existing.blogText) {
        const blogText = existing.blogText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        fullText += blogText;
      }

      // Create document using Drive API
      const createResponse = await drive.files.create({
        requestBody: {
          name: documentTitle,
          mimeType: 'application/vnd.google-apps.document',
        },
        fields: 'id',
      });

      const documentId = createResponse.data.id;

      // Make document accessible
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'writer',
          type: 'anyone',
        },
      });

      // Add content
      if (fullText) {
        const requests = [
          {
            insertText: {
              location: { index: 1 },
              text: fullText,
            },
          },
          {
            updateParagraphStyle: {
              range: {
                startIndex: titleStart,
                endIndex: titleEnd,
              },
              paragraphStyle: {
                namedStyleType: 'HEADING_1',
              },
              fields: 'namedStyleType',
            },
          },
        ];

        await docs.documents.batchUpdate({
          documentId,
          requestBody: { requests },
        });
      }

      finalGoogleDocUrl = `https://docs.google.com/document/d/${documentId}/edit`;
      console.log(`✅ Created Google Doc: ${finalGoogleDocUrl}`);
    }

    // Upsert: update with googleDocUrl if provided, otherwise just show current state
    if (finalGoogleDocUrl) {
      const updated = await prisma.blogs.update({
        where: { id: blogId },
        data: { googleDocUrl: finalGoogleDocUrl },
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
      console.log(`\nOr export to Google Docs first:`);
      console.log(`   node scripts/upsert-blog-google-doc-url.js ${blogId} --export`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
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
