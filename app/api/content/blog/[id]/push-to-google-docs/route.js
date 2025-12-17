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
    
    // Build full text content
    let fullText = '';
    let titleStart = 1;
    let titleEnd = 1;
    let subtitleStart = -1;
    let subtitleEnd = -1;
    
    // Title
    fullText += documentTitle + '\n';
    titleEnd = documentTitle.length + 1;
    
    // Subtitle (if exists)
    if (blog.subtitle) {
      subtitleStart = fullText.length + 1;
      fullText += blog.subtitle + '\n\n';
      subtitleEnd = fullText.length;
    } else {
      fullText += '\n';
    }
    
    // Blog text content
    if (blog.blogText) {
      const blogText = blog.blogText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      fullText += blogText;
    }

    // Create the document using Drive API (service accounts can create files they own)
    const createResponse = await drive.files.create({
      requestBody: {
        name: documentTitle,
        mimeType: 'application/vnd.google-apps.document',
      },
      fields: 'id',
    });

    const documentId = createResponse.data.id;

    // Make the document accessible (anyone with the link can view)
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
    });

    // Build batch update requests
    const requests = [];
    
    // Insert all text at once
    if (fullText) {
      requests.push({
        insertText: {
          location: { index: 1 },
          text: fullText,
        },
      });
    }
    
    // Apply title formatting (HEADING_1)
    requests.push({
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
    });
    
    // Apply subtitle formatting (HEADING_2) if exists
    if (subtitleStart > 0 && subtitleEnd > 0) {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: subtitleStart,
            endIndex: subtitleEnd,
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
          },
          fields: 'namedStyleType',
        },
      });
    }

    // Batch update the document with content and formatting
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests,
        },
      });
    }

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
    console.error('❌ Push to Google Docs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to push blog to Google Docs',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
