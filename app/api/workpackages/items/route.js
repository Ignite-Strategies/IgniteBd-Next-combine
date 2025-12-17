import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculatePhaseTotalDuration } from '@/lib/services/DurationNormalizationService';

/**
 * POST /api/workpackages/items
 * Create WorkPackageItem and update phase duration
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
    const {
      workPackageId,
      workPackagePhaseId,
      itemType,
      itemLabel,
      itemDescription,
      quantity,
      unitOfMeasure,
      duration,
    } = body;

    if (!workPackageId || !workPackagePhaseId || !itemType || !itemLabel) {
      return NextResponse.json(
        { success: false, error: 'workPackageId, workPackagePhaseId, itemType, and itemLabel are required' },
        { status: 400 },
      );
    }

    // Verify phase exists
    const phase = await prisma.workPackagePhase.findUnique({
      where: { id: workPackagePhaseId },
      include: {
        items: true,
      },
    });

    if (!phase || phase.workPackageId !== workPackageId) {
      return NextResponse.json(
        { success: false, error: 'Phase not found' },
        { status: 404 },
      );
    }

    // Create item
    const item = await prisma.workPackageItem.create({
      data: {
        workPackageId,
        workPackagePhaseId,
        itemType,
        itemLabel,
        itemDescription: itemDescription || null,
        quantity: quantity || 1,
        unitOfMeasure: unitOfMeasure || 'day',
        duration: duration || 1,
        status: 'todo',
      },
    });

    // Update phase total duration
    const allItems = [...phase.items, item];
    const phaseTotalDuration = calculatePhaseTotalDuration(allItems);

    await prisma.workPackagePhase.update({
      where: { id: workPackagePhaseId },
      data: { phaseTotalDuration },
    });

    return NextResponse.json({
      success: true,
      item: {
        ...item,
        phase: {
          ...phase,
          phaseTotalDuration,
        },
      },
    });
  } catch (error) {
    console.error('❌ CreateWorkPackageItem error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create work package item',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workpackages/items/:id
 * Update WorkPackageItem and recalculate phase duration
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
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { itemLabel, itemDescription, quantity, unitOfMeasure, duration, status } = body;

    // Get existing item with phase
    const existingItem = await prisma.workPackageItem.findUnique({
      where: { id },
      include: {
        workPackagePhase: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 },
      );
    }

    // Update item
    const updateData = {};
    if (itemLabel !== undefined) updateData.itemLabel = itemLabel;
    if (itemDescription !== undefined) updateData.itemDescription = itemDescription;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unitOfMeasure !== undefined) updateData.unitOfMeasure = unitOfMeasure;
    if (duration !== undefined) updateData.duration = duration;
    if (status !== undefined) updateData.status = status;

    const item = await prisma.workPackageItem.update({
      where: { id },
      data: updateData,
    });

    // Recalculate phase total duration
    const phase = existingItem.workPackagePhase;
    const allItems = phase.items.map(i => i.id === id ? item : i);
    const phaseTotalDuration = calculatePhaseTotalDuration(allItems);

    await prisma.workPackagePhase.update({
      where: { id: phase.id },
      data: { phaseTotalDuration },
    });

    return NextResponse.json({
      success: true,
      item,
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
 * DELETE /api/workpackages/items/:id
 * Delete WorkPackageItem and recalculate phase duration
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
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 },
      );
    }

    // Get existing item with phase
    const existingItem = await prisma.workPackageItem.findUnique({
      where: { id },
      include: {
        workPackagePhase: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 },
      );
    }

    const phaseId = existingItem.workPackagePhaseId;

    // Delete item
    await prisma.workPackageItem.delete({
      where: { id },
    });

    // Recalculate phase total duration
    const phase = existingItem.workPackagePhase;
    const remainingItems = phase.items.filter(i => i.id !== id);
    const phaseTotalDuration = calculatePhaseTotalDuration(remainingItems);

    await prisma.workPackagePhase.update({
      where: { id: phaseId },
      data: { phaseTotalDuration },
    });

    return NextResponse.json({
      success: true,
      message: 'Item deleted',
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
