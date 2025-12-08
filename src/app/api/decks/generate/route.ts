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
        pptxUrl: presentation.gammaPptxUrl,
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

    // Call Gamma API
    let fileUrl: string;
    try {
      const result = await generateDeckWithGamma(blob);
      fileUrl = result.fileUrl;
    } catch (gammaError) {
      const errorMessage =
        gammaError instanceof Error
          ? gammaError.message
          : 'Unknown error from Gamma API';

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

    // Gamma API returns a URL - it could be a deck URL or PPTX URL
    // We'll store it as gammaDeckUrl and check if we can extract a PPTX URL
    // Note: Gamma may return different formats, so we store what we get
    const isPptxUrl = fileUrl.includes('.pptx') || fileUrl.includes('pptx');
    const deckUrl = isPptxUrl ? null : fileUrl;
    const pptxUrl = isPptxUrl ? fileUrl : null;

    // Save URLs and set status to ready
    await prisma.presentation.update({
      where: { id: presentationId },
      data: {
        gammaStatus: 'ready',
        gammaDeckUrl: deckUrl || fileUrl, // Store deck URL (or fileUrl if we can't determine)
        gammaPptxUrl: pptxUrl,
        gammaError: null,
      },
    });

    console.log('✅ Deck generated successfully for presentation:', presentationId);

    return NextResponse.json({
      success: true,
      status: 'ready',
      deckUrl: deckUrl || fileUrl,
      pptxUrl: pptxUrl,
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

