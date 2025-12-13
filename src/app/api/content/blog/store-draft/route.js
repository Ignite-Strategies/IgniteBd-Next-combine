import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { storeBlogDraft } from '@/lib/redis';

/**
 * POST /api/content/blog/store-draft
 * Store generated blog draft in Redis temporarily
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
    const { blogDraft, title, subtitle } = body ?? {};

    if (!blogDraft) {
      return NextResponse.json(
        { success: false, error: 'blogDraft is required' },
        { status: 400 },
      );
    }

    const redisKey = await storeBlogDraft(blogDraft, title, subtitle);

    return NextResponse.json({
      success: true,
      redisKey,
    });
  } catch (error) {
    console.error('❌ StoreBlogDraft error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to store blog draft',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
