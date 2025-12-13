import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { checkGammaGenerationStatus } from '@/lib/deck/gamma-service';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/decks/status/[generationId]
 * Check the status of a Gamma generation
 * 
 * Also accepts presentationId query param to update the presentation record
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ generationId: string }> }
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
    const { generationId } = await params;
    const { searchParams } = new URL(request.url);
    const presentationId = searchParams.get('presentationId');

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: 'generationId is required' },
        { status: 400 }
      );
    }

    // Check generation status
    const statusResult = await checkGammaGenerationStatus(generationId);

    // Log the status response payload
    console.log('📊 Gamma status check result:', {
      generationId,
      status: statusResult.status,
      gammaUrl: statusResult.gammaUrl,
      id: statusResult.id,
      url: statusResult.url,
      pptxUrl: statusResult.pptxUrl,
      error: statusResult.error,
      credits: statusResult.credits,
    });

    // Normalize URL field (Gamma API uses 'gammaUrl', but we support both)
    const deckUrl = statusResult.gammaUrl || statusResult.url;

    // If presentationId provided, update the presentation record
    if (presentationId) {
      if (statusResult.status === 'completed' && deckUrl) {
        // Generation complete - store URLs
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'ready',
            gammaDeckUrl: deckUrl,
            gammaPptxUrl: statusResult.pptxUrl || null,
            gammaError: null,
          },
        });
        console.log('✅ Updated presentation with completed status and URLs');
      } else if (statusResult.status === 'failed' || statusResult.status === 'error') {
        // Generation failed
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'error',
            gammaError: statusResult.error || 'Generation failed',
          },
        });
        console.log('❌ Updated presentation with failed status');
      } else if (statusResult.status === 'processing' || statusResult.status === 'pending') {
        // Still processing - normal state, continue polling
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'generating',
          },
        });
        console.log('🔄 Updated presentation with processing status (continuing to poll)');
      } else {
        // Unknown status (including 'completed' without URL) - keep as generating
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'generating',
          },
        });
        console.log('⚠️ Unknown or incomplete status, keeping as generating:', statusResult.status);
      }
    }

    return NextResponse.json({
      success: true,
      status: statusResult.status === 'completed' ? 'ready' : statusResult.status, // Map 'completed' to 'ready' for frontend
      id: statusResult.generationId || statusResult.id,
      url: deckUrl,
      pptxUrl: statusResult.pptxUrl,
      error: statusResult.error,
    });
  } catch (error) {
    console.error('❌ CheckGenerationStatus error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check generation status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

