import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/events/ops/list
 * List bd_event_ops for a user, optionally filtered by eventPlanId
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    const ownerId = searchParams.get('ownerId');
    const eventPlanId = searchParams.get('eventPlanId');
    const hasNoPlan = searchParams.get('hasNoPlan') === 'true'; // Get events not yet in a plan

    if (!companyHQId || !ownerId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and ownerId are required' },
        { status: 400 }
      );
    }

    const where: any = {
      companyHQId,
      ownerId,
    };

    if (eventPlanId) {
      where.eventPlanId = eventPlanId;
    } else if (hasNoPlan) {
      where.eventPlanId = null;
    }

    const events = await prisma.bdEventOps.findMany({
      where,
      orderBy: [
        { startDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: any) {
    console.error('❌ List events ops error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list events',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
