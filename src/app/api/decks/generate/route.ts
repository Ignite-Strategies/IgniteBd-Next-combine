import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { buildGammaBlob } from '@/lib/deck/blob-mapper';
import { generateDeckWithGamma } from '@/lib/deck/gamma-service';
import type { DeckSpec } from '@/lib/deck/blob-mapper';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/decks/generate
 * Generate a deck using Gamma API
 * 
 * Request body:
 * {
 *   deckArtifactId: string
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
    const { deckArtifactId } = body;

    if (!deckArtifactId) {
      return NextResponse.json(
        { success: false, error: 'deckArtifactId is required' },
        { status: 400 }
      );
    }

    // Load DeckArtifact with its structured outline
    const deckArtifact = await prisma.deckArtifact.findUnique({
      where: { id: deckArtifactId },
    });

    if (!deckArtifact) {
      return NextResponse.json(
        { success: false, error: 'Deck artifact not found' },
        { status: 404 }
      );
    }

    // Check if already generating or ready
    if (deckArtifact.status === 'generating') {
      return NextResponse.json(
        { success: false, error: 'Deck is already being generated' },
        { status: 409 }
      );
    }

    if (deckArtifact.status === 'ready' && deckArtifact.fileUrl) {
      return NextResponse.json({
        success: true,
        status: 'ready',
        fileUrl: deckArtifact.fileUrl,
        message: 'Deck already generated',
      });
    }

    // Parse outlineJson as DeckSpec
    const deckSpec = deckArtifact.outlineJson as DeckSpec;

    if (!deckSpec || !deckSpec.title || !deckSpec.slides) {
      return NextResponse.json(
        { success: false, error: 'Invalid deck specification in outlineJson' },
        { status: 400 }
      );
    }

    // Generate blob from DeckSpec
    const blob = buildGammaBlob(deckSpec);

    // Save blob to DB and set status to generating
    await prisma.deckArtifact.update({
      where: { id: deckArtifactId },
      data: {
        blobText: blob,
        status: 'generating',
      },
    });

    // Call Gamma API
    let fileUrl: string;
    try {
      const result = await generateDeckWithGamma(blob);
      fileUrl = result.fileUrl;
    } catch (gammaError) {
      // Update status to error
      await prisma.deckArtifact.update({
        where: { id: deckArtifactId },
        data: {
          status: 'error',
        },
      });

      const errorMessage =
        gammaError instanceof Error
          ? gammaError.message
          : 'Unknown error from Gamma API';

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate deck with Gamma',
          details: errorMessage,
        },
        { status: 500 }
      );
    }

    // Save fileUrl and set status to ready
    await prisma.deckArtifact.update({
      where: { id: deckArtifactId },
      data: {
        fileUrl,
        status: 'ready',
      },
    });

    console.log('✅ Deck generated successfully:', deckArtifactId);

    return NextResponse.json({
      success: true,
      status: 'ready',
      fileUrl,
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

