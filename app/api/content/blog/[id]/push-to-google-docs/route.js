import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getGoogleDocsClient, getGoogleDriveClient, initializeGoogleAuth } from '@/lib/googleServiceAccount';

/**
 * POST /api/content/blog/[id]/push-to-google-docs
 * Push a blog to Google Docs
 */
export async function POST(request, { params }) {
  console.log('🚨🚨🚨 ADAM TEST - EXPORT ROUTE CALLED - NEW CODE IS RUNNING 🚨🚨🚨');
  console.log('🚨 Git commit: 7969109');
  console.log('🚨 Time:', new Date().toISOString());
  
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
    
    // 5️⃣ PREFLIGHT: Check folder access before creating
    console.log(`🔍 PREFLIGHT: Checking access to folder ${parentFolderId}...`);
    try {
      const folderCheck = await drive.files.get({
        fileId: parentFolderId,
        fields: 'id, name, parents, driveId, capabilities, owners(emailAddress)',
        supportsAllDrives: true,
      });
      
      console.log('✅ PREFLIGHT: Folder access confirmed:', {
        folderId: folderCheck.data.id,
        folderName: folderCheck.data.name,
        folderParents: folderCheck.data.parents,
        folderDriveId: folderCheck.data.driveId,
        folderOwners: folderCheck.data.owners,
        capabilities: folderCheck.data.capabilities,
      });
      
      if (folderCheck.data.driveId) {
        console.log('📁 Folder is in a Shared Drive:', folderCheck.data.driveId);
      } else {
        console.log('📁 Folder is in My Drive (not a Shared Drive)');
      }
    } catch (folderError) {
      console.error('❌ PREFLIGHT FAILED: Cannot access folder:', {
        folderId: parentFolderId,
        error: folderError.message,
        code: folderError.code,
        errors: folderError.errors,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or inaccessible parent folder',
          details: `Cannot access folder ${parentFolderId}. The service account may not have permission.`,
          folderId: parentFolderId,
          errorCode: folderError.code,
          errorDetails: folderError.message,
        },
        { status: 400 },
      );
    }
    
    console.log(`📄 Creating Google Doc: "${documentTitle}" in folder ${parentFolderId}`);
    
    // 1️⃣ WIDEN: Request full diagnostic metadata
    // 2️⃣ SUPPORT SHARED DRIVES: Add supportsAllDrives
    const createResponse = await drive.files.create({
      requestBody: {
        name: documentTitle,
        mimeType: 'application/vnd.google-apps.document',
        parents: [parentFolderId],
      },
      fields: 'id, name, parents, owners(emailAddress), driveId, createdTime',
      supportsAllDrives: true,
    });
    
    const file = createResponse.data;
    console.log('✅ Drive API Response:', {
      documentId: file.id,
      documentName: file.name,
      actualParents: file.parents,
      owners: file.owners,
      driveId: file.driveId,
      createdTime: file.createdTime,
    });
    
    // 3️⃣ HARD ASSERTION: Verify Google honored the parent folder
    if (!file.parents || !file.parents.includes(parentFolderId)) {
      console.error('❌ ASSERTION FAILED: Google Drive ignored parent folder!', {
        expectedParent: parentFolderId,
        actualParents: file.parents,
        documentId: file.id,
      });
      
      throw new Error(
        `Drive ignored parent folder. Expected ${parentFolderId}, got ${JSON.stringify(file.parents)}`
      );
    }
    console.log('✅ ASSERTION PASSED: Document created in correct folder');
    
    // 4️⃣ LOG WHICH DRIVE WAS USED
    if (file.driveId) {
      console.log('📁 Document created in SHARED DRIVE:', file.driveId);
    } else {
      console.log('📁 Document created in MY DRIVE (service account personal drive)');
    }
    
    const documentId = file.id;

    // Make the document accessible (anyone with the link can view)
    // 2️⃣ SUPPORT SHARED DRIVES: Add supportsAllDrives
    console.log('🔓 Setting document permissions...');
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
      supportsAllDrives: true,
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
    // 6️⃣ IMPROVED ERROR SURFACING: Always log full details
    console.error('❌ Push to Google Docs error:', error);
    console.error('🔍 FULL ERROR DETAILS:', {
      message: error.message,
      code: error.code,
      status: error.status,
      errors: error.errors,
      response: error.response?.data,
      stack: error.stack,
    });
    
    // Check if it's a storage quota error
    const isStorageError = error.message?.includes('storageQuotaExceeded') || 
                          error.message?.includes('storage exceeded') ||
                          (error.code === 403 && error.errors?.[0]?.reason === 'storageQuotaExceeded');
    
    if (isStorageError) {
      console.error('🚨 STORAGE QUOTA ERROR DETECTED');
      console.error('🔍 This means Google Drive rejected the request due to storage limits');
      console.error('🔍 Check the logs above to see which Drive was used');
      
      return NextResponse.json(
        {
          success: false,
          error: 'Google Drive storage limit exceeded',
          details: 'The Drive storage quota has been exceeded. Check server logs for which Drive was used.',
          errorType: 'STORAGE_QUOTA_EXCEEDED',
          rawError: error.message,
          errorCode: error.code,
          errorReason: error.errors?.[0]?.reason,
          // Show full error in development
          ...(process.env.NODE_ENV === 'development' && {
            fullErrorDetails: {
              message: error.message,
              code: error.code,
              errors: error.errors,
              response: error.response?.data,
            },
          }),
        },
        { status: 507 }, // 507 Insufficient Storage
      );
    }
    
    // Return detailed error for debugging (6️⃣)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to push blog to Google Docs',
        details: error.message,
        errorCode: error.code,
        errorReason: error.errors?.[0]?.reason,
        errorStatus: error.status,
        // Show full error details in development
        ...(process.env.NODE_ENV === 'development' && {
          fullErrorDetails: {
            message: error.message,
            code: error.code,
            errors: error.errors,
            response: error.response?.data,
          },
        }),
      },
      { status: error.status || 500 },
    );
  }
}
