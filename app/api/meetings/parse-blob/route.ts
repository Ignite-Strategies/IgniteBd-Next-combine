import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseMeetingBlobService } from '@/lib/services/parseMeetingBlobService';

/**
 * POST /api/meetings/parse-blob
 *
 * Parse free-text meeting note into structured data for pre-filling the Log Meeting form.
 *
 * Body: { blob: string }
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const blob = body?.blob;
    if (typeof blob !== 'string' || !blob.trim()) {
      return NextResponse.json(
        { success: false, error: 'blob is required' },
        { status: 400 }
      );
    }

    const parsed = await parseMeetingBlobService(blob);

    return NextResponse.json({
      success: true,
      parsed: {
        contactName: parsed.contactName,
        contactEmail: parsed.contactEmail,
        companyName: parsed.companyName,
        meetingContext: parsed.meetingContext,
        relationshipHints: parsed.relationshipHints,
        suggestedMeetingType: parsed.suggestedMeetingType,
        suggestedDisposition: parsed.suggestedDisposition,
        rawNotes: parsed.rawNotes,
      },
    });
  } catch (error: any) {
    console.error('POST /api/meetings/parse-blob error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to parse blob' },
      { status: 500 }
    );
  }
}
