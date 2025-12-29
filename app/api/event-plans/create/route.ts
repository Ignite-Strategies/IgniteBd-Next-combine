import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/event-plans/create
 * Create an event plan and link selected bd_event_ops to it
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
    const { companyHQId, ownerId, name, description, year, eventOpIds } = body;

    if (!companyHQId || !ownerId || !name) {
      return NextResponse.json(
        { success: false, error: 'companyHQId, ownerId, and name are required' },
        { status: 400 }
      );
    }

    if (!eventOpIds || !Array.isArray(eventOpIds) || eventOpIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'eventOpIds array is required' },
        { status: 400 }
      );
    }

    // Verify all events exist and belong to the user
    const events = await prisma.bdEventOps.findMany({
      where: {
        id: { in: eventOpIds },
        companyHQId,
        ownerId,
      },
    });

    if (events.length !== eventOpIds.length) {
      return NextResponse.json(
        { success: false, error: 'Some events not found or do not belong to you' },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalCost = events.reduce((sum, event) => {
      // Parse costBand or estimate from costMin/costMax if available
      // For now, just return null - we can calculate later
      return sum;
    }, 0);

    // Generate IDs (Prisma doesn't auto-generate for these models based on schema)
    const eventPlanId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create event plan
    const eventPlan = await prisma.event_plans.create({
      data: {
        id: eventPlanId,
        companyHQId,
        ownerId,
        name,
        description: description || null,
        year: year || null,
        totalCost: null, // TODO: Calculate from events
        totalTrips: events.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Link events to plan via event_plan_opps
    await Promise.all(
      events.map((event, index) =>
        prisma.event_plan_opps.create({
          data: {
            id: `plan_opp_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            eventPlanId: eventPlan.id,
            bdEventOppId: event.id,
            order: index,
            createdAt: new Date(),
          },
        })
      )
    );

    // Update events to link to plan
    await prisma.bdEventOps.updateMany({
      where: {
        id: { in: eventOpIds },
      },
      data: {
        eventPlanId: eventPlan.id,
      },
    });

    return NextResponse.json({
      success: true,
      eventPlan,
    });
  } catch (error: any) {
    console.error('❌ Create event plan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create event plan',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

