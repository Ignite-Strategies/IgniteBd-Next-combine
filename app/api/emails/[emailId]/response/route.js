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
          },
        },
      },
    });

    console.log('✅ Response recorded for email:', emailId);

    // Move contact deal pipeline from engaged-awaiting-response → interest when they respond
    const contactId = updatedEmail.contactId;
    if (contactId) {
      try {
        const pipe = await prisma.pipelines.findUnique({ where: { contactId } });
        if (pipe?.pipeline === 'prospect' && pipe?.stage === 'engaged-awaiting-response') {
          await prisma.pipelines.update({
            where: { contactId },
            data: { stage: 'interest', updatedAt: new Date() },
          });
          console.log('✅ Deal pipeline stage → interest for contact:', contactId);
        }
      } catch (pipeErr) {
        console.warn('⚠️ Could not update deal pipeline stage:', pipeErr.message);
      }
    }

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
