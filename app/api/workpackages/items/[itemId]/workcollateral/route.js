import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/workpackages/items/:itemId/workcollateral
 * Create WorkCollateral and automatically update item status
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { itemId } = await params;
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { type, title, contentJson, status = 'IN_PROGRESS' } = body;

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'type is required' },
        { status: 400 },
      );
    }

    // Verify item exists
    const item = await prisma.workPackageItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'WorkPackageItem not found' },
        { status: 404 },
      );
    }

    // Validate status
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_NEEDED', 'CHANGES_IN_PROGRESS', 'APPROVED'];
    const normalizedStatus = status.toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Create WorkCollateral
    const workCollateral = await prisma.workCollateral.create({
      data: {
        workPackageItemId: itemId,
        type,
        title: title || null,
        contentJson: contentJson || null,
        status: normalizedStatus,
        reviewRequestedAt: normalizedStatus === 'IN_REVIEW' ? new Date() : null,
        reviewCompletedAt: normalizedStatus === 'APPROVED' ? new Date() : null,
      },
    });

    // Automatically update item status based on WorkCollateral status
    let itemStatus = item.status;
    
    switch (normalizedStatus) {
      case 'IN_PROGRESS':
        itemStatus = 'IN_PROGRESS';
        break;
      
      case 'IN_REVIEW':
        itemStatus = 'IN_REVIEW';
        break;
      
      case 'CHANGES_NEEDED':
        itemStatus = 'CHANGES_NEEDED';
        break;
      
      case 'CHANGES_IN_PROGRESS':
        itemStatus = 'CHANGES_IN_PROGRESS';
        break;
      
      case 'APPROVED':
        // Only approve item if ALL collateral are approved
        const allCollateral = await prisma.workCollateral.findMany({
          where: { workPackageItemId: itemId },
        });
        
        if (allCollateral.every(c => c.status === 'APPROVED')) {
          itemStatus = 'APPROVED';
        }
        break;
    }

    // Update item status if it changed
    if (itemStatus !== item.status) {
      await prisma.workPackageItem.update({
        where: { id: itemId },
        data: { status: itemStatus },
      });
    }

    return NextResponse.json({
      success: true,
      workCollateral,
    });
  } catch (error) {
    console.error('❌ CreateWorkCollateral error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create work collateral',
        details: error.message,
      },
      { status: 500 },
    );
  }
}


