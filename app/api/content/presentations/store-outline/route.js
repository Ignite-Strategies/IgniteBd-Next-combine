import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { storePresentationOutline } from '@/lib/redis';

/**
 * POST /api/content/presentations/store-outline
 * Store generated outline in Redis temporarily
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { outline, title, description } = body ?? {};

    if (!outline) {
      return NextResponse.json(
        { success: false, error: 'Outline is required' },
        { status: 400 },
      );
    }

    const redisKey = await storePresentationOutline(outline, title, description);

    return NextResponse.json({
      success: true,
      redisKey,
    });
  } catch (error) {
    console.error('❌ StoreOutline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to store outline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
