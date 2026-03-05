import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { synthesizeEngagementSummary } from '@/lib/services/synthesizeEngagementSummaryService';

/**
 * POST /api/contacts/[contactId]/synthesize-engagement-summary
 * Generate a synthesized engagement summary from all email activity summaries.
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
    const contactId = resolvedParams?.contactId;
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const result = await synthesizeEngagementSummary(contactId);

    return NextResponse.json({
      success: true,
      summary: result.summary,
      updated: result.updated,
    });
  } catch (error) {
    console.error('❌ POST synthesize-engagement-summary error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to synthesize engagement summary',
        details: error?.message,
      },
      { status: 500 },
    );
  }
}
