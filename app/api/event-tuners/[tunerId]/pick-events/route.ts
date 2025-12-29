import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { pickEventsByPreferences } from '@/lib/services/EventPickerService';

/**
 * GET /api/event-tuners/[tunerId]/pick-events
 * Get OpenAI-picked events based on preferences, organized by time frame
 */
export async function GET(
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

    if (!tunerId) {
      return NextResponse.json(
        { success: false, error: 'tunerId is required' },
        { status: 400 }
      );
    }

    const pickerResult = await pickEventsByPreferences(tunerId);

    return NextResponse.json({
      success: true,
      ...pickerResult,
    });
  } catch (error: any) {
    console.error('❌ Pick events error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to pick events',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

