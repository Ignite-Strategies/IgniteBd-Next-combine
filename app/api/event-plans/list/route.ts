import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/event-plans/list
 * List event_plans records for a company/owner
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

    if (!companyHQId || !ownerId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and ownerId are required' },
        { status: 400 }
      );
    }

    const plans = await prisma.event_plans.findMany({
      where: {
        companyHQId,
        ownerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get event counts for each plan
    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        const eventCount = await prisma.event_plan_opps.count({
          where: { eventPlanId: plan.id },
        });
        return {
          ...plan,
          _count: {
            event_plan_opps: eventCount,
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      plans: plansWithCounts,
    });
  } catch (error: any) {
    console.error('❌ List event_plans error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list event plans',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

