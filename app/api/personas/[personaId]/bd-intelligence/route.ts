import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { generatePersonaBDIntelligence } from '@/lib/services/PersonaBDIntelligenceService';

/**
 * GET /api/personas/[personaId]/bd-intelligence
 * Get BD Intelligence signals for a persona (Market Intelligence)
 * Read-only, no user preferences
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { personaId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!personaId) {
      return NextResponse.json(
        { success: false, error: 'personaId is required' },
        { status: 400 }
      );
    }

    const bdSignals = await generatePersonaBDIntelligence(personaId, limit);

    return NextResponse.json({
      success: true,
      signals: bdSignals,
    });
  } catch (error: any) {
    console.error('❌ Get BD Intelligence error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get BD intelligence',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

