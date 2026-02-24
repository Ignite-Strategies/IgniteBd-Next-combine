import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PUT /api/emails/[emailId]/response
 * Record a response from the contact
 * 
 * Body: {
 *   contactResponse: string (the reply text)
 *   respondedAt?: string (ISO date, defaults to now)
 *   responseSubject?: string
 * }
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
    const resolvedParams = await params;
    const { emailId } = resolvedParams || {};
    
    if (!emailId) {
      return NextResponse.json(
        { success: false, error: 'emailId is required' },
        { status: 400 },
      );
    }

    const email = await prisma.emails.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { contactResponse, respondedAt, responseSubject } = body ?? {};

    if (!contactResponse) {
      return NextResponse.json(
        { success: false, error: 'contactResponse is required' },
        { status: 400 },
      );
    }

    // Parse respondedAt or use now
    const responseDate = respondedAt ? new Date(respondedAt) : new Date();
    if (isNaN(responseDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid respondedAt date format' },
        { status: 400 },
      );
    }

    // Update email with response
    const updatedEmail = await prisma.emails.update({
      where: { id: emailId },
      data: {
        contactResponse,
        respondedAt: responseDate,
        responseSubject: responseSubject || null,
        hasResponded: true,
      },
      include: {
        contacts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            outreachPipelineStatus: true,
          },
        },
      },
    });

    // Update contact pipeline status to RESPONDED
    if (updatedEmail.contacts) {
      await prisma.contact.update({
        where: { id: updatedEmail.contacts.id },
        data: { outreachPipelineStatus: 'RESPONDED' },
      }).catch(err => {
        console.warn('Failed to update pipeline status:', err);
        // Don't fail the request if status update fails
      });
    }

    console.log('✅ Response recorded for email:', emailId);

    return NextResponse.json({
      success: true,
      email: {
        id: updatedEmail.id,
        hasResponded: updatedEmail.hasResponded,
        contactResponse: updatedEmail.contactResponse,
        respondedAt: updatedEmail.respondedAt.toISOString(),
        responseSubject: updatedEmail.responseSubject,
        contact: updatedEmail.contacts,
      },
    });
  } catch (error) {
    console.error('❌ Record response error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record response',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
