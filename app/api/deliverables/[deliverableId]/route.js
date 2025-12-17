import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/deliverables/:deliverableId
 * Get a single deliverable by ID
 */
export async function GET(request, { params }) {
  // Optional auth for read operations
  await optionallyVerifyFirebaseToken(request);

  try {
    const { deliverableId } = params || {};
    if (!deliverableId) {
      return NextResponse.json(
        { success: false, error: 'deliverableId is required' },
        { status: 400 },
      );
    }

    const deliverable = await prisma.consultantDeliverable.findUnique({
      where: { id: deliverableId },
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
        proposal: {
          select: {
            id: true,
            clientName: true,
            clientCompany: true,
            status: true,
            purpose: true,
          },
        },
      },
    });

    if (!deliverable) {
      return NextResponse.json(
        { success: false, error: 'Deliverable not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      deliverable,
    });
  } catch (error) {
    console.error('❌ GetDeliverable error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deliverable',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/deliverables/:deliverableId
 * Update a deliverable
 * 
 * Body (all optional):
 * - title
 * - description
 * - category
 * - status (pending, in-progress, completed, blocked)
 * - dueDate
 * - completedAt (auto-set if status is "completed")
 * - notes
 */
export async function PUT(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { deliverableId } = params || {};
    if (!deliverableId) {
      return NextResponse.json(
        { success: false, error: 'deliverableId is required' },
        { status: 400 },
      );
    }

    const existingDeliverable = await prisma.consultantDeliverable.findUnique({
      where: { id: deliverableId },
    });

    if (!existingDeliverable) {
      return NextResponse.json(
        { success: false, error: 'Deliverable not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      category,
      status,
      dueDate,
      completedAt,
      notes,
    } = body ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (category !== undefined) updateData.category = category || null;
    if (status !== undefined) {
      updateData.status = status;
      
      // Auto-set completedAt if status is "completed" and not already set
      if (status === 'completed' && !existingDeliverable.completedAt) {
        updateData.completedAt = new Date();
      }
      
      // Clear completedAt if status changes from "completed"
      if (status !== 'completed' && existingDeliverable.completedAt) {
        updateData.completedAt = null;
      }
    }
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }
    if (completedAt !== undefined) {
      updateData.completedAt = completedAt ? new Date(completedAt) : null;
    }
    if (notes !== undefined) updateData.notes = notes || null;

    const deliverable = await prisma.consultantDeliverable.update({
      where: { id: deliverableId },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        proposal: {
          select: {
            id: true,
            clientName: true,
            clientCompany: true,
            status: true,
          },
        },
      },
    });

    console.log('✅ Deliverable updated:', deliverable.id);

    return NextResponse.json({
      success: true,
      deliverable,
    });
  } catch (error) {
    console.error('❌ UpdateDeliverable error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update deliverable',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/deliverables/:deliverableId
 * Delete a deliverable
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
    const { deliverableId } = params || {};
    if (!deliverableId) {
      return NextResponse.json(
        { success: false, error: 'deliverableId is required' },
        { status: 400 },
      );
    }

    const deliverable = await prisma.consultantDeliverable.findUnique({
      where: { id: deliverableId },
    });

    if (!deliverable) {
      return NextResponse.json(
        { success: false, error: 'Deliverable not found' },
        { status: 404 },
      );
    }

    await prisma.consultantDeliverable.delete({
      where: { id: deliverableId },
    });

    console.log('✅ Deliverable deleted:', deliverableId);

    return NextResponse.json({
      success: true,
      message: 'Deliverable deleted',
    });
  } catch (error) {
    console.error('❌ DeleteDeliverable error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete deliverable',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

