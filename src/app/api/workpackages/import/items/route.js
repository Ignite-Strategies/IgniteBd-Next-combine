import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { upsertItem, updatePhaseTotalHours, calculatePackageHours } from '@/lib/services/workpackageHydrationService';

/**
 * POST /api/workpackages/import/items
 * Step 3: Import items for existing WorkPackage and phases
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { workPackageId, items } = body;

    if (!workPackageId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: 'workPackageId and items array are required' },
        { status: 400 },
      );
    }

    // Verify work package exists
    const workPackage = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
    });

    if (!workPackage) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage not found' },
        { status: 404 },
      );
    }

    const createdItems = [];
    const updatedItems = [];
    const phaseIds = new Set();

    // Upsert each item
    for (const item of items) {
      const {
        workPackagePhaseId,
        deliverableType,
        deliverableLabel,
        deliverableDescription,
        quantity,
        unitOfMeasure,
        estimatedHoursEach,
        status,
      } = item;

      if (!workPackagePhaseId || !deliverableType || !deliverableLabel) {
        continue; // Skip invalid items
      }

      // Verify phase exists
      const phase = await prisma.workPackagePhase.findUnique({
        where: { id: workPackagePhaseId },
      });

      if (!phase || phase.workPackageId !== workPackageId) {
        continue; // Skip items with invalid phase
      }

      const existing = await prisma.workPackageItem.findFirst({
        where: {
          workPackageId,
          workPackagePhaseId,
          deliverableLabel,
        },
      });

      await upsertItem({
        workPackageId,
        workPackagePhaseId,
        deliverableType,
        deliverableLabel,
        deliverableDescription,
        quantity: quantity || 1,
        unitOfMeasure: unitOfMeasure || 'item',
        estimatedHoursEach: estimatedHoursEach || 0,
        status: status || 'not_started',
      });

      if (existing) {
        updatedItems.push(existing.id);
      } else {
        createdItems.push('new');
      }

      phaseIds.add(workPackagePhaseId);
    }

    // Update phase totals
    for (const phaseId of phaseIds) {
      await updatePhaseTotalHours(phaseId);
    }

    // Calculate total hours
    const totalEstimatedHours = await calculatePackageHours(workPackageId);

    return NextResponse.json({
      success: true,
      summary: {
        itemsCreated: createdItems.length,
        itemsUpdated: updatedItems.length,
        totalEstimatedHours,
      },
    });
  } catch (error) {
    console.error('❌ Import items error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import items',
      },
      { status: 500 },
    );
  }
}

