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
  { params }: { params: { generationId: string } }
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
    const { generationId } = params;
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

    // If presentationId provided, update the presentation record
    if (presentationId) {
      if (statusResult.status === 'ready' && statusResult.id && statusResult.url) {
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'ready',
            gammaDeckUrl: statusResult.url,
            gammaPptxUrl: null,
            gammaError: null,
          },
        });
      } else if (statusResult.status === 'error') {
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'error',
            gammaError: statusResult.error || 'Generation failed',
          },
        });
      } else {
        // Still processing
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'generating',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: statusResult.status,
      id: statusResult.id,
      url: statusResult.url,
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

