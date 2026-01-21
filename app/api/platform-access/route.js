import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import PlatformAccessService from '@/lib/services/platformAccessService';

/**
 * Helper: Get owner's companyHQId from Firebase token
 */
async function getOwnerCompanyHQId(firebaseUser) {
  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    include: {
      company_memberships: {
        include: {
          company_hqs: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!owner) {
    throw new Error('Owner not found for Firebase user');
  }

  // Get first membership's companyHQId
  const companyHQId = owner.company_memberships?.[0]?.company_hqs?.id;
  
  if (!companyHQId) {
    throw new Error('Owner has no associated CompanyHQ');
  }

  return { owner, companyHQId };
}

/**
 * POST /api/platform-access
 * 
 * Create platform access for a company.
 * 
 * For Owners: If companyId not provided, uses owner's default companyHQId
 * For Super Admins: Can assign to any companyId
 * 
 * Body: { planId, companyId? (optional for owners), stripeSubscriptionId? }
 */
export async function POST(request) {
  try {
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      include: {
        company_memberships: {
          include: {
            company_hqs: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { companyId, planId, stripeSubscriptionId } = body ?? {};

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 },
      );
    }

    // Determine companyId
    let targetCompanyId = companyId;

    // If no companyId provided, use owner's first membership (or default companyHQId)
    if (!targetCompanyId) {
      const membership = owner.company_memberships?.[0];
      if (membership) {
        targetCompanyId = membership.company_hqs.id;
      } else {
        return NextResponse.json(
          { error: 'companyId required - owner has no company membership' },
          { status: 400 },
        );
      }
    }

    // Verify owner has access to this company (unless super admin)
    // TODO: Add super admin check here if needed
    const hasAccess = owner.company_memberships.some(
      m => m.company_hqs.id === targetCompanyId
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: No access to this company' },
        { status: 403 },
      );
    }

    const platformAccess = await PlatformAccessService.grantAccess(
      targetCompanyId,
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

