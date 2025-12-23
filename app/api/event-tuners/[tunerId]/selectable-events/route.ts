import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { generateSelectableEvents } from '@/lib/services/EventSelectionService';

/**
 * GET /api/event-tuners/[tunerId]/selectable-events
 * Get selectable events for an EventTuner (filtered by constraints, ranked by persona fit)
 */
export async function GET(
  request: Request,
  { params }: { params: { tunerId: string } }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { tunerId } = params;

    if (!tunerId) {
      return NextResponse.json(
        { success: false, error: 'tunerId is required' },
        { status: 400 }
      );
    }

    const selectableEvents = await generateSelectableEvents(tunerId);

    return NextResponse.json({
      success: true,
      events: selectableEvents,
    });
  } catch (error: any) {
    console.error('❌ Get selectable events error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get selectable events',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

