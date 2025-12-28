import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/event-tuners/[tunerId]
 * Get a single event tuner by ID with full details
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

    const tuner = await prisma.event_tuners.findUnique({
      where: { id: tunerId },
      include: {
        preferredStates: true,
        event_tuner_personas: {
          include: {
            personas: {
              select: {
                id: true,
                personName: true,
                title: true,
                industry: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!tuner) {
      return NextResponse.json(
        { success: false, error: 'Event tuner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tuner,
    });
  } catch (error: any) {
    console.error('❌ Get event tuner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get event tuner',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

