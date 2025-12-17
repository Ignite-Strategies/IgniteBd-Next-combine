import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getEnrichedContactByKey } from '@/lib/redis';

/**
 * GET /api/contacts/enrich/raw
 * 
 * Get raw enrichment JSON from Redis
 * 
 * Query params:
 * - redisKey: Redis key (required)
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const redisKey = searchParams.get('redisKey');

    if (!redisKey) {
      return NextResponse.json(
        { success: false, error: 'redisKey is required' },
        { status: 400 },
      );
    }

    const redisData = await getEnrichedContactByKey(redisKey);
    if (!redisData || !redisData.rawEnrichmentPayload) {
      return NextResponse.json(
        { success: false, error: 'Enrichment data not found in Redis' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      rawEnrichmentPayload: redisData.rawEnrichmentPayload,
    });
  } catch (error: any) {
    console.error('❌ Get raw enrichment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch raw enrichment',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

