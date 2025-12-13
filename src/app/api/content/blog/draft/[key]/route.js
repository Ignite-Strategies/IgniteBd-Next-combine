import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getBlogDraft, deleteBlogDraft } from '@/lib/redis';

/**
 * GET /api/content/blog/draft/[key]
 * Get stored blog draft from Redis
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { key } = await params;
    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 },
      );
    }

    const data = await getBlogDraft(key);

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Blog draft not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('❌ GetBlogDraft error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get blog draft',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/content/blog/draft/[key]
 * Delete stored blog draft from Redis
 */
export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { key } = await params;
    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 },
      );
    }

    const deleted = await deleteBlogDraft(key);

    return NextResponse.json({
      success: deleted,
    });
  } catch (error) {
    console.error('❌ DeleteBlogDraft error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete blog draft',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
