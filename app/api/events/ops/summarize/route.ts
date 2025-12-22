import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { summarizeIntelToOps } from '@/lib/services/EventIntelToOpsService';

/**
 * POST /api/events/ops/summarize
 * Summarize bd_eventop_intel results into bd_event_ops for user selection
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { intelIds, companyHQId, ownerId } = body;

    if (!intelIds || !Array.isArray(intelIds) || intelIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'intelIds array is required' },
        { status: 400 }
      );
    }

    if (!companyHQId || !ownerId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and ownerId are required' },
        { status: 400 }
      );
    }

    const eventOps = await summarizeIntelToOps(intelIds, companyHQId, ownerId);

    return NextResponse.json({
      success: true,
      eventOps,
    });
  } catch (error: any) {
    console.error('❌ Summarize intel to ops error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to summarize intelligence into events',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

