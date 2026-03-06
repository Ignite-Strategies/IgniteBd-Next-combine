import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { listContactsDue } from '@/lib/services/engagementService';

/**
 * GET /api/outreach/reminders
 * @deprecated Use GET /api/outreach/next-engagements instead (same data, response key "nextEngagements").
 * Kept for backward compatibility; returns same list under key "reminders".
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

    const reminders = await listContactsDue(companyHQId, { limit });

    return NextResponse.json({
      success: true,
      reminders,
    });
  } catch (error) {
    console.error('❌ GET /api/outreach/reminders error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reminders', details: error?.message },
      { status: 500 },
    );
  }
}
