import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/portal/review/cle/feedback
 * Save feedback for a specific section of a presentation
 * 
 * Body:
 * {
 *   "presentationId": "<id>",
 *   "sectionIndex": <number>,
 *   "comment": "<string>"
 * }
 */
export async function POST(request: Request) {
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

    const body = await request.json();
    const { workCollateralId, sectionIndex, comment } = body;

    if (!workCollateralId || typeof sectionIndex !== 'number' || typeof comment !== 'string') {
      return NextResponse.json(
        { success: false, error: 'workCollateralId, sectionIndex, and comment are required' },
        { status: 400 },
      );
    }

    // Fetch WorkCollateral (contains the presentation snapshot)
    const workCollateral = await prisma.workCollateral.findUnique({
      where: { id: workCollateralId },
    });

    if (!workCollateral) {
      return NextResponse.json(
        { success: false, error: 'WorkCollateral not found' },
        { status: 404 },
      );
    }

    // Get existing content snapshot
    const contentJson = (workCollateral.contentJson as any) || {};
    
    // Get existing feedback or initialize empty object
    const existingFeedback = contentJson.feedback || {};

    // Update feedback for this section
    const updatedFeedback = {
      ...existingFeedback,
      [sectionIndex.toString()]: comment,
    };

    // Update WorkCollateral.contentJson with new feedback
    // This updates the snapshot, not a Content Hub artifact
    await prisma.workCollateral.update({
      where: { id: workCollateralId },
      data: {
        contentJson: {
          ...contentJson,
          feedback: updatedFeedback,
        },
      },
    });

    return NextResponse.json({
      success: true,
      status: 'ok',
    });
  } catch (error: any) {
    console.error('❌ SaveFeedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message?.includes('Unauthorized') ? 'Unauthorized' : 'Failed to save feedback',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 },
    );
  }
}

