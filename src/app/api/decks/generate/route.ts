import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { buildGammaBlob } from '@/lib/deck/blob-mapper';
import { generateDeckWithGamma } from '@/lib/deck/gamma-service';
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

    // Call Gamma API
    let gammaId: string;
    let deckUrl: string;
    try {
      console.log('🎨 Calling Gamma API for presentation:', presentationId);
      const result = await generateDeckWithGamma(blob);
      gammaId = result.id;
      deckUrl = result.url;
      console.log('✅ Gamma API returned:', { id: gammaId, url: deckUrl });
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

    // Gamma API returns id (gammaId) and url (shareable deck URL)
    // Store the URL as gammaDeckUrl
    await prisma.presentation.update({
      where: { id: presentationId },
      data: {
        gammaStatus: 'ready',
        gammaDeckUrl: deckUrl,
        gammaPptxUrl: null, // Gamma v1.0 returns shareable URL, not separate PPTX
        gammaError: null,
      },
    });

    console.log('✅ Deck generated successfully for presentation:', presentationId);

    return NextResponse.json({
      success: true,
      status: 'ready',
      id: gammaId,
      deckUrl: deckUrl,
    });
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

