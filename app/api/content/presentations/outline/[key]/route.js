import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getPresentationOutline, deletePresentationOutline } from '@/lib/redis';

/**
 * GET /api/content/presentations/outline/[key]
 * Get stored outline from Redis
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
    const { key } = params;
    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 },
      );
    }

    const data = await getPresentationOutline(key);

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Outline not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('❌ GetOutline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get outline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/content/presentations/outline/[key]
 * Delete stored outline from Redis
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
    const { key } = params;
    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 },
      );
    }

    const deleted = await deletePresentationOutline(key);

    return NextResponse.json({
      success: deleted,
    });
  } catch (error) {
    console.error('❌ DeleteOutline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete outline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
