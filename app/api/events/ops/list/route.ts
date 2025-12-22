import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/events/ops/list
 * List bd_event_ops records for a company/owner
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
    const source = searchParams.get('source');
    const status = searchParams.get('status');

    const where: any = {};
    if (companyHQId) where.companyHQId = companyHQId;
    if (ownerId) where.ownerId = ownerId;
    if (eventPlanId) where.eventPlanId = eventPlanId;
    if (source) where.source = source;
    if (status) where.status = status;

    const eventOps = await prisma.bdEventOps.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      eventOps,
    });
  } catch (error: any) {
    console.error('❌ List bd_event_ops error:', error);
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

