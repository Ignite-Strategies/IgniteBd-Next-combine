import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/events/ops/create
 * Create a new bd_event_ops record (user-facing event)
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
    const {
      companyHQId,
      ownerId,
      eventPlanId,
      title,
      description,
      whyGo,
      eventType,
      startDate,
      endDate,
      city,
      state,
      country,
      costBand,
      source = 'MANUAL',
    } = body;

    if (!companyHQId || !ownerId || !title || !eventType) {
      return NextResponse.json(
        { success: false, error: 'companyHQId, ownerId, title, and eventType are required' },
        { status: 400 }
      );
    }

    const eventOp = await prisma.bdEventOps.create({
      data: {
        companyHQId,
        ownerId,
        eventPlanId: eventPlanId || null,
        title,
        description: description || null,
        whyGo: whyGo || null,
        eventType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        city: city || null,
        state: state || null,
        country: country || null,
        costBand: costBand || null,
        source,
        status: 'CONSIDERING',
      },
    });

    return NextResponse.json({
      success: true,
      eventOp,
    });
  } catch (error: any) {
    console.error('❌ Create bd_event_ops error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create event',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

