import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { synthesizeContactSummary } from '@/lib/services/synthesizeContactSummaryService';

/**
 * POST /api/contacts/[contactId]/synthesize-contact-summary
 * Generate a rich contact narrative: who they are, relationship, disposition, buying signals.
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const contactId = resolvedParams?.contactId;
    if (!contactId) {
      return NextResponse.json({ success: false, error: 'contactId is required' }, { status: 400 });
    }

    const result = await synthesizeContactSummary(contactId);

    return NextResponse.json({
      success: true,
      summary: result.summary,
      updated: result.updated,
    });
  } catch (error) {
    console.error('❌ POST synthesize-contact-summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to synthesize contact summary', details: error?.message },
      { status: 500 },
    );
  }
}
