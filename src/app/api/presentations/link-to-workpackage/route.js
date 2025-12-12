import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/presentations/link-to-workpackage
 * Link a presentation from Content Hub to a WorkPackageItem by copying content into WorkCollateral
 * 
 * This creates a snapshot copy of the presentation content in WorkCollateral, allowing it
 * to be used as a deliverable in a work package that clients can review.
 * 
 * Body:
 * {
 *   "presentationId": "cmic5u0z70001lh04ixfps3bs",
 *   "workItemId": "cmi2l87w1000jlb048diknzxh"
 * }
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
    const { presentationId, workItemId } = body;

    if (!presentationId || !workItemId) {
      return NextResponse.json(
        { success: false, error: 'presentationId and workItemId are required' },
        { status: 400 },
      );
    }

    // Find the original presentation
    const originalPresentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
    });

    if (!originalPresentation) {
      return NextResponse.json(
        { success: false, error: 'Original presentation not found' },
        { status: 404 },
      );
    }

    // Verify the workItem exists
    const workItem = await prisma.workPackageItem.findUnique({
      where: { id: workItemId },
      include: {
        workPackage: {
          include: {
            contact: {
              include: {
                companyHQ: true,
              },
            },
          },
        },
      },
    });

    if (!workItem) {
      return NextResponse.json(
        { success: false, error: 'WorkItem not found' },
        { status: 404 },
      );
    }

    // Copy the presentation content into WorkCollateral as a snapshot
    // DO NOT create a new Presentation - WorkCollateral contains the full snapshot
    const presentationSnapshot = {
      title: originalPresentation.title,
      slides: originalPresentation.slides,
      presenter: originalPresentation.presenter,
      description: originalPresentation.description,
      feedback: {}, // Start with empty feedback object
    };

    console.log('📋 Copying presentation content to WorkCollateral snapshot');
    console.log('🔗 Linking to WorkItem:', workItemId);

    // Create WorkCollateral entry with full content snapshot
    const workCollateral = await prisma.workCollateral.create({
      data: {
        workPackageItemId: workItemId,
        workPackageId: workItem.workPackageId,
        type: 'PRESENTATION_DECK',
        title: originalPresentation.title,
        contentJson: presentationSnapshot, // Full snapshot copy, not a reference
        status: 'IN_PROGRESS',
      },
    });

    console.log('✅ WorkCollateral created with presentation snapshot:', workCollateral.id);

    return NextResponse.json({
      success: true,
      workCollateral,
      workCollateralId: workCollateral.id,
      message: `Presentation content copied to work package deliverable successfully.`,
    });
  } catch (error) {
    console.error('❌ LinkPresentationToWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to link presentation to work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

