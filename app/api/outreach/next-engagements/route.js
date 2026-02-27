import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getContactsWithNextEngagement } from '@/lib/services/nextEngagementService';

/**
 * GET /api/outreach/next-engagements
 * Contacts with nextEngagementDate set. Hydrate and show — no notifications. Query: companyHQId (required), limit (default 500).
 */
export async function GET(request) {
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
    const companyHQId = searchParams.get('companyHQId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 500);

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const nextEngagements = await getContactsWithNextEngagement(companyHQId, { limit });

    return NextResponse.json({
      success: true,
      nextEngagements,
    });
  } catch (error) {
    console.error('❌ GET /api/outreach/next-engagements error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch next engagements', details: error?.message },
      { status: 500 },
    );
  }
}
