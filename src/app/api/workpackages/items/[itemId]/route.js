import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PATCH /api/workpackages/items/:itemId
 * Update WorkPackageItem (label, quantity, status)
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
    const { itemId } = params;
    const body = await request.json();
    const { itemLabel, itemDescription, quantity, unitOfMeasure, duration, status } = body ?? {};

    const item = await prisma.workPackageItem.findUnique({
      where: { id: itemId },
      include: {
        workPackagePhase: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'WorkPackageItem not found' },
        { status: 404 },
      );
    }

    const updateData = {};
    if (itemLabel !== undefined) updateData.itemLabel = itemLabel;
    if (itemDescription !== undefined) updateData.itemDescription = itemDescription;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unitOfMeasure !== undefined) updateData.unitOfMeasure = unitOfMeasure;
    if (duration !== undefined) updateData.duration = duration;
    if (status !== undefined) {
      // Validate status is one of the canonical statuses
      const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_NEEDED', 'CHANGES_IN_PROGRESS', 'APPROVED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 },
        );
      }
      updateData.status = status.toUpperCase();
    }

    const updated = await prisma.workPackageItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Recalculate phase total duration if quantity, unitOfMeasure, or duration changed
    if (quantity !== undefined || unitOfMeasure !== undefined || duration !== undefined) {
      const { calculatePhaseTotalDuration } = await import('@/lib/services/DurationNormalizationService');
      const phase = item.workPackagePhase;
      const allItems = phase.items.map(i => i.id === itemId ? updated : i);
      const phaseTotalDuration = calculatePhaseTotalDuration(allItems);

      await prisma.workPackagePhase.update({
        where: { id: phase.id },
        data: { phaseTotalDuration },
      });
    }

    return NextResponse.json({
      success: true,
      item: updated,
    });
  } catch (error) {
    console.error('❌ UpdateWorkPackageItem error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update work package item',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workpackages/items/:itemId
 * Delete WorkPackageItem
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
    const { itemId } = params;

    await prisma.workPackageItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      success: true,
      message: 'WorkPackageItem deleted',
    });
  } catch (error) {
    console.error('❌ DeleteWorkPackageItem error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete work package item',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
