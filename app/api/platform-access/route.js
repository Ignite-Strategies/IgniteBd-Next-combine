import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import PlatformAccessService from '@/lib/services/platformAccessService';

/**
 * POST /api/platform-access
 * 
 * Create platform access for a company.
 * No Stripe logic inside this route.
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { companyId, planId, stripeSubscriptionId } = body ?? {};

    if (!companyId || !planId) {
      return NextResponse.json(
        { error: 'companyId and planId are required' },
        { status: 400 },
      );
    }

    const platformAccess = await PlatformAccessService.grantAccess(
      companyId,
      planId,
      stripeSubscriptionId
    );

    return NextResponse.json({
      success: true,
      platformAccess,
    });
  } catch (error) {
    console.error('❌ Error creating platform access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create platform access' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/platform-access
 * 
 * List platform access records (with optional filters).
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');

    const where = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;

    const accesses = await prisma.platform_accesses.findMany({
      where,
      include: {
        plans: true,
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      accesses,
    });
  } catch (error) {
    console.error('❌ Error fetching platform access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch platform access' },
      { status: 500 },
    );
  }
}

