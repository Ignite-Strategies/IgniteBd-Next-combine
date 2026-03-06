import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { computeNextEngagement } from '@/lib/services/engagementService';

/**
 * POST /api/contacts/[contactId]/compute-engagement
 *
 * Workhorse: reads lastEngagementDate + rules → computes and persists nextEngagementDate.
 * Called explicitly by the user ("Calculate Engagement" button) — never auto-triggered by ingest.
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const result = await computeNextEngagement(contactId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Compute engagement error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to compute engagement',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
