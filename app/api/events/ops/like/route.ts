import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/events/ops/like
 * Save an event as "I like it" - creates bd_event_ops from EventMeta
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
    const { eventMetaId, companyHQId, ownerId, eventTunerId, whyGo } = body;

    if (!eventMetaId || !companyHQId || !ownerId) {
      return NextResponse.json(
        { success: false, error: 'eventMetaId, companyHQId, and ownerId are required' },
        { status: 400 }
      );
    }

    // Get EventMeta
    const eventMeta = await prisma.event_metas.findUnique({
      where: { id: eventMetaId },
    });

    if (!eventMeta) {
      return NextResponse.json(
        { success: false, error: 'EventMeta not found' },
        { status: 404 }
      );
    }

    // Check if already exists
    const existing = await prisma.bdEventOps.findFirst({
      where: {
        companyHQId,
        ownerId,
        title: eventMeta.name,
        startDate: eventMeta.startDate,
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        eventOp: existing,
        message: 'Event already saved',
      });
    }

    // Determine cost band
    const costBand = eventMeta.costMin && eventMeta.costMax
      ? determineCostBand(eventMeta.costMin, eventMeta.costMax)
      : null;

    // Create bd_event_ops
    const eventOp = await prisma.bdEventOps.create({
      data: {
        companyHQId,
        ownerId,
        eventTunerId: eventTunerId || null,
        title: eventMeta.name,
        description: null,
        whyGo: whyGo || null,
        eventType: eventMeta.eventType,
        startDate: eventMeta.startDate,
        endDate: eventMeta.endDate,
        city: eventMeta.city,
        state: eventMeta.state,
        country: eventMeta.country,
        costBand,
        source: eventTunerId ? 'USER_PREF' : 'MANUAL',
        status: 'CONSIDERING',
      },
    });

    return NextResponse.json({
      success: true,
      eventOp,
    });
  } catch (error: any) {
    console.error('❌ Like event error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save event',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

function determineCostBand(costMin: number, costMax: number): string {
  const avg = (costMin + costMax) / 2;
  if (avg === 0) return 'FREE';
  if (avg < 500) return 'LOW';
  if (avg < 2000) return 'MEDIUM';
  if (avg < 5000) return 'HIGH';
  return 'PREMIUM';
}

