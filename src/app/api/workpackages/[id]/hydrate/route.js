import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateWorkPackage } from '@/lib/services/WorkPackageHydrationService';

/**
 * GET /api/workpackages/:id/hydrate
 * Hydrate WorkPackage with full data including phases, items, artifacts, and contactCompany
 * Returns the same structure as owner hydrate but accessible via simpler route
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
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage ID is required' },
        { status: 400 },
      );
    }

    const workPackage = await prisma.workPackage.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            contactCompany: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        phases: {
          select: {
            id: true,
            name: true,
            position: true,
            description: true,
            phaseTotalDuration: true,
            totalEstimatedHours: true,
            estimatedStartDate: true,
            estimatedEndDate: true,
            actualStartDate: true,
            actualEndDate: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            items: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workPackage) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage not found' },
        { status: 404 },
      );
    }

    // Hydrate with artifacts, phases, and timeline calculations
    const hydrated = await hydrateWorkPackage(workPackage, {
      clientView: false,
      includeTimeline: true,
    });

    // Transform to match expected structure with contactCompany at top level
    const transformed = {
      ...hydrated,
      contactCompany: hydrated.contact?.contactCompany || hydrated.company || null,
    };

    return NextResponse.json({
      success: true,
      workPackage: transformed,
    });
  } catch (error) {
    console.error('❌ HydrateWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to hydrate work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

