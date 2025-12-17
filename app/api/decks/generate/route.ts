import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { buildGammaBlob } from '@/lib/deck/blob-mapper';
import { generateDeckWithGamma, checkGammaGenerationStatus } from '@/lib/deck/gamma-service';
import { presentationToDeckSpec } from '@/lib/deck/presentation-converter';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/decks/generate
 * Generate a deck using Gamma API from a Presentation
 * 
 * Request body:
 * {
 *   presentationId: string
 * }
 */
export async function POST(request: Request) {
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
    const body = await request.json();
    const { presentationId } = body;

    if (!presentationId) {
      return NextResponse.json(
        { success: false, error: 'presentationId is required' },
        { status: 400 }
      );
    }

    // Load Presentation
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
    });

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found' },
        { status: 404 }
      );
    }

    // Check if already generating or ready
    if (presentation.gammaStatus === 'generating') {
      return NextResponse.json(
        { success: false, error: 'Deck is already being generated' },
        { status: 409 }
      );
    }

    if (presentation.gammaStatus === 'ready' && presentation.gammaDeckUrl) {
      return NextResponse.json({
        success: true,
        status: 'ready',
        deckUrl: presentation.gammaDeckUrl,
        message: 'Deck already generated',
      });
    }

    // Normalize slides structure before conversion
    let normalizedSlides = presentation.slides;
    if (normalizedSlides) {
      // If slides is a string, try to parse it
      if (typeof normalizedSlides === 'string') {
        try {
          normalizedSlides = JSON.parse(normalizedSlides);
        } catch (e) {
          console.warn(`Failed to parse slides JSON for presentation ${presentation.id}:`, e);
          normalizedSlides = { sections: [] };
        }
      }
      // Ensure slides has sections array
      if (typeof normalizedSlides === 'object' && normalizedSlides !== null) {
        if (!normalizedSlides.sections || !Array.isArray(normalizedSlides.sections)) {
          normalizedSlides.sections = [];
        }
      } else {
        normalizedSlides = { sections: [] };
      }
    } else {
      normalizedSlides = { sections: [] };
    }

    // Convert Presentation.slides to DeckSpec
    const deckSpec = presentationToDeckSpec(
      presentation.title,
      presentation.description,
      normalizedSlides as any
    );

    if (!deckSpec || !deckSpec.title || !deckSpec.slides || deckSpec.slides.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Presentation has no slides to generate' },
        { status: 400 }
      );
    }

    // Generate blob from DeckSpec
    const blob = buildGammaBlob(deckSpec);

    // Save blob to DB and set status to generating
    await prisma.presentation.update({
      where: { id: presentationId },
      data: {
        gammaBlob: blob,
        gammaStatus: 'generating',
        gammaError: null,
      },
    });

    // Check if Gamma API key is configured
    if (!process.env.GAMMA_API_KEY) {
      console.error('❌ GAMMA_API_KEY environment variable is not set');
      await prisma.presentation.update({
        where: { id: presentationId },
        data: {
          gammaStatus: 'error',
          gammaError: 'GAMMA_API_KEY not configured',
        },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Gamma API key not configured. Please set GAMMA_API_KEY environment variable.',
        },
        { status: 500 }
      );
    }

    // Call Gamma API (asynchronous - returns only generationId)
    let generationId: string;
    try {
      console.log('🎨 Calling Gamma API for presentation:', presentationId);
      const result = await generateDeckWithGamma(blob);
      generationId = result.generationId;
      console.log('✅ Gamma API returned generationId:', generationId);
    } catch (gammaError) {
      // Better error extraction and logging
      let errorMessage = 'Unknown error from Gamma API';
      
      if (gammaError instanceof Error) {
        errorMessage = gammaError.message;
      } else if (gammaError && typeof gammaError === 'object') {
        // Try to extract meaningful error info from object
        errorMessage = JSON.stringify(gammaError, Object.getOwnPropertyNames(gammaError), 2);
      } else {
        errorMessage = String(gammaError);
      }

      console.error('❌ Gamma API error:', {
        errorMessage,
        errorType: typeof gammaError,
        errorConstructor: gammaError?.constructor?.name,
        fullError: gammaError,
        errorString: JSON.stringify(gammaError, Object.getOwnPropertyNames(gammaError || {})),
      });

      // Update status to error
      await prisma.presentation.update({
        where: { id: presentationId },
        data: {
          gammaStatus: 'error',
          gammaError: errorMessage,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate deck with Gamma',
          details: errorMessage,
        },
        { status: 500 }
      );
    }

    // Store generationId and set status to generating
    // The generation is asynchronous - we'll check status separately
    await prisma.presentation.update({
      where: { id: presentationId },
      data: {
        gammaGenerationId: generationId,
        gammaStatus: 'generating',
        gammaError: null,
      },
    });

    // Check generation status immediately (might be ready already)
    try {
      const statusResult = await checkGammaGenerationStatus(generationId);
      
      if (statusResult.status === 'completed' && statusResult.gammaUrl) {
        // Generation is already complete
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'ready',
            gammaDeckUrl: statusResult.gammaUrl,
            gammaPptxUrl: statusResult.pptxUrl || null,
            gammaError: null,
          },
        });

        console.log('✅ Deck generated successfully (immediate):', presentationId);

        return NextResponse.json({
          success: true,
          status: 'ready',
          id: statusResult.id,
          deckUrl: statusResult.gammaUrl,
          pptxUrl: statusResult.pptxUrl,
        });
      } else if (statusResult.status === 'error' || statusResult.status === 'failed') {
        // Generation failed
        await prisma.presentation.update({
          where: { id: presentationId },
          data: {
            gammaStatus: 'error',
            gammaError: statusResult.error || 'Generation failed',
          },
        });

        return NextResponse.json({
          success: false,
          error: 'Gamma generation failed',
          details: statusResult.error || 'Unknown error',
        }, { status: 500 });
      } else {
        // Still processing - return generationId for client to poll
        console.log('⏳ Deck generation in progress:', presentationId);

        return NextResponse.json({
          success: true,
          status: 'generating',
          generationId: generationId,
          message: 'Generation started. Use GET /api/decks/status/{generationId} to check status.',
        });
      }
    } catch (statusError) {
      // Status check failed, but generation was started
      // Client can poll for status later
      console.warn('⚠️ Could not check initial generation status:', statusError);
      
      return NextResponse.json({
        success: true,
        status: 'generating',
        generationId: generationId,
        message: 'Generation started. Status check will be available shortly.',
      });
    }
  } catch (error) {
    console.error('❌ GenerateDeck error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate deck',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

