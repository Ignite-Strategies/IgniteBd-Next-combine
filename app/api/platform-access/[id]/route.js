import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import PlatformAccessService from '@/lib/services/platformAccessService';

/**
 * PATCH /api/platform-access/:id
 * 
 * Update platform access (pause, revoke, etc.).
 * No Stripe logic inside this route.
 */
export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { status, ...otherFields } = body ?? {};

    if (!id) {
      return NextResponse.json(
        { error: 'Platform access ID is required' },
        { status: 400 },
      );
    }

    // Handle status changes through service methods
    if (status === 'PAUSED') {
      const platformAccess = await PlatformAccessService.pauseAccess(id);
      return NextResponse.json({
        success: true,
        platformAccess,
      });
    }

    if (status === 'EXPIRED') {
      const platformAccess = await PlatformAccessService.revokeAccess(id);
      return NextResponse.json({
        success: true,
        platformAccess,
      });
    }

    // Allow other field updates
    const platformAccess = await prisma.platform_accesses.update({
      where: { id },
      data: {
        ...otherFields,
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      success: true,
      platformAccess,
    });
  } catch (error) {
    console.error('❌ Error updating platform access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update platform access' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/platform-access/:id
 * 
 * Get a specific platform access record.
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params;

    const platformAccess = await prisma.platform_accesses.findUnique({
      where: { id },
      include: {
        plans: true,
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (!platformAccess) {
      return NextResponse.json(
        { error: 'Platform access not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      platformAccess,
    });
  } catch (error) {
    console.error('❌ Error fetching platform access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch platform access' },
      { status: 500 },
    );
  }
}

