import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createEventOpsFromSelection } from '@/lib/services/EventSelectionService';

/**
 * POST /api/event-tuners/[tunerId]/select
 * Save selected events from EventTuner as bd_event_ops
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tunerId: string }> }
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
    const { tunerId } = await params;
    const body = await request.json();
    const { selectedEventIds, companyHQId, ownerId } = body;

    if (!tunerId) {
      return NextResponse.json(
        { success: false, error: 'tunerId is required' },
        { status: 400 }
      );
    }

    if (!companyHQId || !ownerId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and ownerId are required' },
        { status: 400 }
      );
    }

    if (!selectedEventIds || !Array.isArray(selectedEventIds) || selectedEventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'selectedEventIds array is required' },
        { status: 400 }
      );
    }

    // Use the service to create event ops from selection
    await createEventOpsFromSelection(tunerId, selectedEventIds, companyHQId, ownerId);

    return NextResponse.json({
      success: true,
      message: `Successfully created ${selectedEventIds.length} event${selectedEventIds.length !== 1 ? 's' : ''}`,
    });
  } catch (error: any) {
    console.error('❌ Select events error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save selected events',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

