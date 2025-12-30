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

    console.log(`🎯 Pick Events API: Starting for tunerId: ${tunerId}`);

    if (!tunerId) {
      console.error('❌ Pick Events API: tunerId is missing');
      return NextResponse.json(
        { success: false, error: 'tunerId is required' },
        { status: 400 }
      );
    }

    console.log(`🔄 Pick Events API: Calling pickEventsByPreferences...`);
    const pickerResult = await pickEventsByPreferences(tunerId);
    
    const eventCount = Object.values(pickerResult.eventsByTimeFrame || {}).reduce(
      (sum, events) => sum + (Array.isArray(events) ? events.length : 0),
      0
    );
    console.log(`✅ Pick Events API: Successfully picked ${eventCount} events across ${Object.keys(pickerResult.eventsByTimeFrame || {}).length} time frames`);

    return NextResponse.json({
      success: true,
      ...pickerResult,
    });
  } catch (error: any) {
    console.error('❌ Pick Events API: Error occurred:', error);
    console.error('❌ Pick Events API: Error stack:', error.stack);
    console.error('❌ Pick Events API: Error message:', error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to pick events',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

