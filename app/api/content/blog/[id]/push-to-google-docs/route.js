import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { initializeGoogleAuth } from '@/lib/googleServiceAccount';
import { assembleAndCreateGoogleDoc } from '@/lib/services/googleDocAssemblyService';

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
    const authClient = await initializeGoogleAuth();
    if (!authClient) {
      return NextResponse.json(
        { success: false, error: 'Google service account not configured' },
        { status: 500 },
      );
    }

    // Get parent folder ID
    const parentFolderId = process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID || '1khO3ytWyY9GUscxSyKPNhG35qRXVFtuT';
    
    // 🧩 ORCHESTRATION: Call assembly service
    const result = await assembleAndCreateGoogleDoc(
      {
        title: blog.title,
        subtitle: blog.subtitle,
        body: blog.blogText,
        parentFolderId,
      },
      authClient,
    );

    // Save the Google Doc URL to the blog record
    await prisma.blogs.update({
      where: { id },
      data: { googleDocUrl: result.documentUrl },
    });

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      documentUrl: result.documentUrl,
      textLength: result.textLength,
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
