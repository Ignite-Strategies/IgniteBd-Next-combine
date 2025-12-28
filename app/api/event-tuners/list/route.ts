import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/event-tuners/list
 * List event_tuners records for a company/owner
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
    const isActive = searchParams.get('isActive'); // Optional filter

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

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const tuners = await prisma.event_tuners.findMany({
      where,
      include: {
        preferredStates: true,
        event_tuner_personas: {
          include: {
            personas: {
              select: {
                id: true,
                personName: true,
                title: true,
              },
            },
          },
        },
        _count: {
          select: {
            bd_event_ops: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      tuners,
    });
  } catch (error: any) {
    console.error('❌ List event_tuners error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list event tuners',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

