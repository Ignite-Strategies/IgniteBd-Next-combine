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
            type: { in: ['CLE_DECK', 'PRESENTATION_DECK'] },
          },
          include: {
            presentation: true, // Load the actual Presentation model
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

    // Find WorkCollateral with Presentation reference
    let presentation = null;
    let workCollateralId = null;
    
    for (const collateral of workItem.workCollateral) {
      if (collateral.type === 'PRESENTATION_DECK' || collateral.type === 'CLE_DECK') {
        // Prefer Presentation model reference over contentJson snapshot
        if (collateral.presentationId && collateral.presentation) {
          presentation = collateral.presentation;
          workCollateralId = collateral.id;
          break;
        }
        // Fallback to contentJson snapshot for backward compatibility
        if (collateral.contentJson && typeof collateral.contentJson === 'object') {
          presentation = collateral.contentJson as any;
          workCollateralId = collateral.id;
          break;
        }
      }
    }

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found for this WorkItem' },
        { status: 404 },
      );
    }

    // Normalize slides structure if it's a Presentation model
    if (presentation.slides) {
      if (typeof presentation.slides === 'string') {
        try {
          presentation.slides = JSON.parse(presentation.slides);
        } catch (e) {
          console.warn(`Failed to parse slides JSON:`, e);
          presentation.slides = { sections: [] };
        }
      }
      if (typeof presentation.slides === 'object' && presentation.slides !== null) {
        if (!presentation.slides.sections || !Array.isArray(presentation.slides.sections)) {
          presentation.slides.sections = [];
        }
      } else {
        presentation.slides = { sections: [] };
      }
    } else {
      presentation.slides = { sections: [] };
    }

    return NextResponse.json({
      success: true,
      presentation,
      workCollateralId,
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

