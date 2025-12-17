import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getGoogleDocsClient, getGoogleDriveClient, initializeGoogleAuth } from '@/lib/googleServiceAccount';

/**
 * POST /api/content/blog/[id]/push-to-google-docs
 * Push a blog to Google Docs
 */
export async function POST(request, { params }) {
  let firebaseUser;
  let owner;

  try {
    firebaseUser = await verifyFirebaseToken(request);
    owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;

    // Fetch the blog
    const blog = await prisma.blogs.findUnique({
      where: { id },
    });

    if (!blog) {
      return NextResponse.json(
        { success: false, error: 'Blog not found' },
        { status: 404 },
      );
    }

    // Verify access through companyHQ
    const companyHQ = await prisma.company_hqs.findFirst({
      where: {
        id: blog.companyHQId,
        ownerId: owner.id,
      },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 },
      );
    }

    // Initialize Google Auth
    const auth = await initializeGoogleAuth();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Google service account not configured' },
        { status: 500 },
      );
    }

    // Get Google Drive and Docs clients
    const drive = getGoogleDriveClient();
    const docs = getGoogleDocsClient();

    // Prepare document content
    const documentTitle = blog.title || 'Untitled Blog';
    
    // 1️⃣ Build simple text content (no index math, no formatting)
    let fullText = '';
    
    // Title
    fullText += documentTitle + '\n';
    
    // Subtitle (if exists)
    if (blog.subtitle) {
      fullText += blog.subtitle + '\n\n';
    } else {
      fullText += '\n';
    }
    
    // Blog text content
    if (blog.blogText) {
      const blogText = blog.blogText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      fullText += blogText;
    }
    
    // 4️⃣ Ensure text is safe (non-empty)
    const safeText = fullText || ' ';

    // MVP: Create doc in restricted folder (no public permissions)
    const parentFolderId = process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID || '1khO3ytWyY9GUscxSyKPNhG35qRXVFtuT';
    
    console.log(`📄 Creating Google Doc: "${documentTitle}"`);
    
    // 2️⃣ MINIMAL + SAFE: Just create the doc
    const createResponse = await drive.files.create({
      requestBody: {
        name: documentTitle,
        mimeType: 'application/vnd.google-apps.document',
        parents: [parentFolderId],
      },
      supportsAllDrives: true,
      fields: 'id',
    });
    
    const documentId = createResponse.data.id;
    console.log(`✅ Document created: ${documentId}`);

    // 1️⃣ MINIMAL DOCS API: Single insertText operation only
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: safeText,
            },
          },
        ],
      },
    });

    // Get the document URL
    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    // Save the Google Doc URL to the blog record
    await prisma.blogs.update({
      where: { id },
      data: { googleDocUrl: documentUrl },
    });

    return NextResponse.json({
      success: true,
      documentId,
      documentUrl,
      message: 'Blog pushed to Google Docs successfully',
    });
  } catch (error) {
    // 4️⃣ MVP ERROR HANDLING: Keep it simple
    console.error('❌ Google Docs export failed:', error.message);
    return NextResponse.json(
      { success: false, error: 'Google Docs export failed' },
      { status: 500 },
    );
  }
}
