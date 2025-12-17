import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/presentations/:id/download
 * Download PPTX file for a presentation
 * 
 * This endpoint handles downloading the PPTX file from Gamma.
 * If gammaPptxUrl exists, it redirects to that URL.
 * If only gammaDeckUrl exists, it attempts to fetch the PPTX export.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Presentation ID is required' },
        { status: 400 }
      );
    }

    // Load Presentation
    const presentation = await prisma.presentation.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        gammaStatus: true,
        gammaDeckUrl: true,
        gammaPptxUrl: true,
      },
    });

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found' },
        { status: 404 }
      );
    }

    // Check if deck is ready
    if (presentation.gammaStatus !== 'ready') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Deck not ready for download',
          status: presentation.gammaStatus || 'pending',
        },
        { status: 400 }
      );
    }

    // If we have a direct PPTX URL, redirect to it
    if (presentation.gammaPptxUrl) {
      return NextResponse.redirect(presentation.gammaPptxUrl);
    }

    // If we only have a deck URL, redirect to it (Gamma doesn't provide direct PPTX download via API)
    // Gamma deck URLs are: https://gamma.app/docs/{id}
    // Users can export PPTX from the Gamma web interface
    if (presentation.gammaDeckUrl) {
      // Redirect to the Gamma deck URL where users can view and export
      return NextResponse.redirect(presentation.gammaDeckUrl);
    }

    return NextResponse.json(
      { success: false, error: 'No deck URL available for download' },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ DownloadPresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to download presentation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

