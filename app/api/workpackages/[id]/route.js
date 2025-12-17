import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateWorkPackage } from '@/lib/services/workpackageHydrationService';
import { upsertWorkPackageEffectiveDate } from '@/lib/services/PhaseDueDateService';

/**
 * GET /api/workpackages/:id
 * Load WorkPackage with items + artifacts (hydrated)
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
    // Get id from params
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage ID is required' },
        { status: 400 },
      );
    }

    const workPackage = await prisma.work_packages.findUnique({
      where: { id },
      include: {
        companies: {
          select: {
            id: true,
            companyName: true,
            companyHQId: true,
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
            companies: {
              select: {
                id: true,
                companyName: true,
              },
            },
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
            work_package_items: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!workPackage) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage not found' },
        { status: 404 },
      );
    }

    // Hydrate with artifacts and progress
    const hydrated = await hydrateWorkPackage(workPackage);

    return NextResponse.json({
      success: true,
      workPackage: hydrated,
    });
  } catch (error) {
    console.error('❌ GetWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workpackages/:id
 * Update WorkPackage status or metadata
 */
export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Get id from params
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage ID is required' },
        { status: 400 },
      );
    }

    // Get update data from request body
    const body = await request.json();
    const { title, description, totalCost, effectiveStartDate, prioritySummary } = body;

    // Build update data object (only include fields that are provided)
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (totalCost !== undefined) updateData.totalCost = totalCost;
    if (effectiveStartDate !== undefined) {
      updateData.effectiveStartDate = effectiveStartDate ? new Date(effectiveStartDate) : null;
    }
    if (prioritySummary !== undefined) updateData.prioritySummary = prioritySummary;

    // Check if effectiveStartDate is being updated
    const wasEffectiveStartDateUpdated = effectiveStartDate !== undefined;

    // Update the work package
    let workPackage = await prisma.work_packages.update({
      where: { id },
      data: updateData,
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
        work_package_phases: {
          select: {
            id: true,
            name: true,
            position: true,
            description: true,
            totalEstimatedHours: true,
            estimatedStartDate: true,
            estimatedEndDate: true,
            actualStartDate: true,
            actualEndDate: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            work_package_items: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    // If effectiveStartDate was updated, update Phase 1 and shift subsequent phases
    if (wasEffectiveStartDateUpdated && effectiveStartDate) {
      try {
        await upsertWorkPackageEffectiveDate(id, effectiveStartDate);
        // Reload work package to get updated phase dates
        const updatedWorkPackage = await prisma.work_packages.findUnique({
          where: { id },
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
            work_package_phases: {
              select: {
                id: true,
                name: true,
                position: true,
                description: true,
                totalEstimatedHours: true,
                phaseTotalDuration: true,
                estimatedStartDate: true,
                estimatedEndDate: true,
                actualStartDate: true,
                actualEndDate: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                work_package_items: {
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
        });
        workPackage = updatedWorkPackage;
      } catch (error) {
        console.warn('Failed to recalculate phase dates:', error);
        // Continue with hydration even if recalculation fails
      }
    }

    // Hydrate with artifacts and progress
    const hydrated = await hydrateWorkPackage(workPackage);

    console.log('✅ WorkPackage updated:', workPackage.id);

    return NextResponse.json({
      success: true,
      workPackage: hydrated,
    });
  } catch (error) {
    console.error('❌ UpdateWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workpackages/:id
 * Delete a WorkPackage and all related phases/items
 */
export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Get id from params
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage ID is required' },
        { status: 400 },
      );
    }

    // Delete WorkPackage (cascade will delete phases and items)
    await prisma.workPackage.delete({
      where: { id },
    });

    console.log('✅ WorkPackage deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'WorkPackage deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

