import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/presentations/duplicate
 * Duplicate a presentation into a WorkItem (WorkPackageItem)
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

    // Get companyHQId from the workItem's workPackage contact
    const companyHQId = workItem.workPackage.contact.companyHQ?.id;
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'Could not determine companyHQId from workItem' },
        { status: 400 },
      );
    }

    // Create the duplicated presentation
    const joelClePresentation = await prisma.presentation.create({
      data: {
        companyHQId,
        title: originalPresentation.title,
        slides: originalPresentation.slides,
        presenter: originalPresentation.presenter,
        description: originalPresentation.description,
        feedback: null, // Start with empty feedback
        published: false,
        publishedAt: null,
      },
    });

    console.log('✅ Duplicated presentation created:', joelClePresentation.id);
    console.log('📋 Presentation title:', joelClePresentation.title);
    console.log('🔗 Linked to WorkItem:', workItemId);

    // Create WorkCollateral entry to link presentation to WorkItem
    const workCollateral = await prisma.workCollateral.create({
      data: {
        workPackageItemId: workItemId,
        workPackageId: workItem.workPackageId,
        type: 'CLE_DECK',
        title: joelClePresentation.title,
        contentJson: {
          presentationId: joelClePresentation.id,
          type: 'presentation',
        },
        status: 'IN_REVIEW',
      },
    });

    console.log('✅ WorkCollateral created:', workCollateral.id);

    return NextResponse.json({
      success: true,
      presentation: joelClePresentation,
      presentationId: joelClePresentation.id,
      workCollateralId: workCollateral.id,
      message: `Presentation duplicated successfully. New presentation ID: ${joelClePresentation.id}`,
    });
  } catch (error) {
    console.error('❌ DuplicatePresentation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to duplicate presentation',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

