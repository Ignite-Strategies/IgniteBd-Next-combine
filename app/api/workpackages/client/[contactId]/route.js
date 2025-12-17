import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateWorkPackage } from '@/lib/services/workpackageHydrationService';

/**
 * GET /api/workpackages/client/:contactId
 * Client portal view - only shows published artifacts
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { contactId } = await params || {};
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 },
      );
    }

    const { searchParams } = request.nextUrl;
    const workPackageId = searchParams.get('workPackageId');

    // Filter by workPackageClientId (client contact) or workPackageMemberId (if they're a member)
    const where = {
      OR: [
        { workPackageClientId: contactId },
        { workPackageMemberId: contactId },
      ],
    };
    if (workPackageId) where.id = workPackageId;

    const workPackages = await prisma.work_packages.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            companyName: true,
          },
        },
        workPackageOwner: {
          select: {
            id: true,
            companyName: true,
          },
        },
        workPackageClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        workPackageMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        work_package_phases: {
          include: {
            work_package_items: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Hydrate with artifacts (only published ones for client view)
    const hydrated = await Promise.all(
      workPackages.map((wp) => hydrateWorkPackage(wp, { clientView: true })),
    );

    return NextResponse.json({
      success: true,
      workPackages: hydrated,
    });
  } catch (error) {
    console.error('❌ GetClientWorkPackages error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get work packages',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

