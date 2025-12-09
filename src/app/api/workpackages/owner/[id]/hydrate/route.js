import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateWorkPackage } from '@/lib/services/workpackageHydrationService';

/**
 * GET /api/workpackages/owner/:id/hydrate
 * Owner App WorkPackage hydration - same data as Client Portal but with timeline calculations
 * Returns WorkPackage with phases (aggregated hours), items (status + estimatedHours + label), and artifacts
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
            totalEstimatedHours: true,
            estimatedStartDate: true, // Calculated: WorkPackage start + previous phases
            estimatedEndDate: true,   // Calculated: estimatedStartDate + (totalEstimatedHours / 8)
            actualStartDate: true,    // Set when phase status → "in_progress"
            actualEndDate: true,      // Set when phase status → "completed"
            status: true,             // not_started | in_progress | completed
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

    // Hydrate with artifacts, phases, and timeline calculations (owner view)
    const hydrated = await hydrateWorkPackage(workPackage, {
      clientView: false,
      includeTimeline: true,
    });

    return NextResponse.json({
      success: true,
      workPackage: hydrated,
    });
  } catch (error) {
    console.error('❌ OwnerWorkPackageHydrate error:', error);
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

