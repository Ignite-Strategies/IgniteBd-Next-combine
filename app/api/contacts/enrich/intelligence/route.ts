import { NextResponse } from 'next/server';
// @ts-ignore - firebaseAdmin is a JS file
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getPreviewIntelligence, getEnrichedContactByKey } from '@/lib/redis';

/**
 * GET /api/contacts/enrich/intelligence?previewId=xxx
 * 
 * Retrieve preview intelligence data from Redis
 * 
 * Query Parameters:
 * - previewId: Preview ID (e.g., "preview:123:abc")
 * 
 * Returns:
 * {
 *   "success": true,
 *   "previewData": {
 *     "previewId": "...",
 *     "redisKey": "...",
 *     "linkedinUrl": "...",
 *     "email": "...",
 *     "normalizedContact": {...},
 *     "normalizedCompany": {...},
 *     "intelligenceScores": {...},
 *     "companyIntelligence": {...}
 *   }
 * }
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
    const previewId = searchParams.get('previewId');

    if (!previewId) {
      return NextResponse.json(
        { success: false, error: 'previewId is required' },
        { status: 400 },
      );
    }

    // Get preview data from Redis
    const previewData = await getPreviewIntelligence(previewId);

    if (!previewData) {
      return NextResponse.json(
        { success: false, error: 'Preview data not found or expired' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      previewData,
    });
  } catch (error: any) {
    console.error('❌ Get intelligence preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve intelligence data',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

