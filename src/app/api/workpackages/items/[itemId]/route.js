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
    const { label, quantity, status, clientArtifactId } = body ?? {};

    const item = await prisma.workPackageItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'WorkPackageItem not found' },
        { status: 404 },
      );
    }

    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (status !== undefined) updateData.status = status;
    if (clientArtifactId !== undefined) updateData.clientArtifactId = clientArtifactId;

    const updated = await prisma.workPackageItem.update({
      where: { id: itemId },
      data: updateData,
    });

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
