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
    console.log('🔐 Initializing Google Auth...');
    const auth = await initializeGoogleAuth();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Google service account not configured' },
        { status: 500 },
      );
    }
    console.log('✅ Google Auth initialized');

    // Get Google Drive and Docs clients
    const drive = getGoogleDriveClient();
    const docs = getGoogleDocsClient();
    console.log('✅ Google Drive and Docs clients ready');

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
    // Optional: Specify parent folder to avoid filling service account's root Drive
    const parentFolderId = process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID || '1khO3ytWyY9GUscxSyKPNhG35qRXVFtuT'; // HARDCODED FOR TESTING
    
    console.log('🔍 DEBUG: process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID =', process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID);
    console.log('🔍 DEBUG: Using parentFolderId =', parentFolderId);
    console.log(`📄 Creating Google Doc: "${documentTitle}"${parentFolderId ? ` in folder ${parentFolderId}` : ' in service account root'}`);
    
    const createResponse = await drive.files.create({
      requestBody: {
        name: documentTitle,
        mimeType: 'application/vnd.google-apps.document',
        // If parent folder is configured, use it; otherwise, doc goes to service account root
        parents: [parentFolderId], // Always use the folder (hardcoded or env)
      },
      fields: 'id',
    });
    
    const documentId = createResponse.data.id;
    console.log(`✅ Document created with ID: ${documentId}`);

    // Make the document accessible (anyone with the link can view)
    console.log('🔓 Setting document permissions...');
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
    });
    console.log('✅ Document permissions set');

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
      console.log(`📝 Applying ${requests.length} formatting updates to document...`);
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests,
        },
      });
      console.log('✅ Document content and formatting applied');
    }

    // Get the document URL
    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    // Save the Google Doc URL to the blog record
    console.log('💾 Saving Google Doc URL to database...');
    await prisma.blogs.update({
      where: { id },
      data: { googleDocUrl: documentUrl },
    });
    console.log(`✅ Blog export complete: ${documentUrl}`);

    return NextResponse.json({
      success: true,
      documentId,
      documentUrl,
      message: 'Blog pushed to Google Docs successfully',
    });
  } catch (error) {
    console.error('❌ Push to Google Docs error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      response: error.response?.data,
      stack: error.stack,
    });
    
    // Check if it's a storage quota error
    const isStorageError = error.message?.includes('storageQuotaExceeded') || 
                          error.message?.includes('storage exceeded') ||
                          (error.code === 403 && error.errors?.[0]?.reason === 'storageQuotaExceeded');
    
    if (isStorageError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Drive storage limit exceeded',
          details: 'The service account Drive storage is full. Please configure GOOGLE_DRIVE_BLOG_FOLDER_ID to use a shared folder with more space.',
          errorType: 'STORAGE_QUOTA_EXCEEDED',
          rawError: error.message,
        },
        { status: 507 }, // 507 Insufficient Storage
      );
    }
    
    // Return detailed error for debugging
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to push blog to Google Docs',
        details: error.message,
        errorCode: error.code,
        errorReason: error.errors?.[0]?.reason,
        fullError: process.env.NODE_ENV === 'development' ? error.toString() : undefined,
      },
      { status: 500 },
    );
  }
}
