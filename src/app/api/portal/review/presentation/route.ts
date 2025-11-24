import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/portal/review/presentation
 * Get the presentation for review (linked to Joel's WorkItem)
 * Finds presentation via WorkCollateral linked to workItemId: cmi2l87w1000jlb048diknzxh
 */
export async function GET(request: Request) {
  try {
    // Verify Firebase token
    const decodedToken = await verifyFirebaseToken(request);
    const firebaseUid = decodedToken.uid;

    // Get contact by Firebase UID
    const contact = await prisma.contact.findUnique({
      where: { firebaseUid },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Find the WorkItem (WorkPackageItem) for Joel
    const workItemId = 'cmi2l87w1000jlb048diknzxh';
    const workItem = await prisma.workPackageItem.findUnique({
      where: { id: workItemId },
      include: {
        workCollateral: {
          where: {
            type: 'CLE_DECK',
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

    // Find the presentation via WorkCollateral
    let presentation = null;
    for (const collateral of workItem.workCollateral) {
      if (collateral.contentJson && typeof collateral.contentJson === 'object') {
        const content = collateral.contentJson as any;
        if (content.presentationId) {
          presentation = await prisma.presentation.findUnique({
            where: { id: content.presentationId },
          });
          if (presentation) break;
        }
      }
    }

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found for this WorkItem' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      presentation,
    });
  } catch (error: any) {
    console.error('❌ GetPresentationForReview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message?.includes('Unauthorized') ? 'Unauthorized' : 'Failed to get presentation',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 },
    );
  }
}

