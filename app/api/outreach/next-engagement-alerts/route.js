import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getContactsWithNextEngagement } from '@/lib/services/nextEngagementService';

/**
 * GET /api/outreach/next-engagement-alerts
 * Single source of truth: Contact.nextEngagementDate. Returns all contacts with nextEngagementDate set.
 * Same data for web (NextEngagementAlertContainer) and for email (future: package into email body).
 * Query: companyHQId (required), limit (default 500). No date filter — consumer filters/buckets (web or email).
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

    const alerts = await getContactsWithNextEngagement(companyHQId, { limit });

    return NextResponse.json({
      success: true,
      alerts,
    });
  } catch (error) {
    console.error('❌ GET /api/outreach/next-engagement-alerts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch next engagement alerts', details: error?.message },
      { status: 500 },
    );
  }
}
