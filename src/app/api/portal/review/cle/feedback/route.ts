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
    const { presentationId, sectionIndex, comment } = body;

    if (!presentationId || typeof sectionIndex !== 'number' || typeof comment !== 'string') {
      return NextResponse.json(
        { success: false, error: 'presentationId, sectionIndex, and comment are required' },
        { status: 400 },
      );
    }

    // Fetch existing presentation
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
    });

    if (!presentation) {
      return NextResponse.json(
        { success: false, error: 'Presentation not found' },
        { status: 404 },
      );
    }

    // Get existing feedback or initialize empty object
    const existingFeedback = (presentation.feedback as Record<string, string> | null) || {};

    // Update feedback for this section
    const updatedFeedback = {
      ...existingFeedback,
      [sectionIndex.toString()]: comment,
    };

    // Update presentation with new feedback
    await prisma.presentation.update({
      where: { id: presentationId },
      data: {
        feedback: updatedFeedback,
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

