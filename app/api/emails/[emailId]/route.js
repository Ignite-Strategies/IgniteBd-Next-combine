import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/emails/[emailId]
 * Get a single email by ID
 */
export async function GET(request, { params }) {
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

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      email: {
        id: email.id,
        contactId: email.contactId,
        sendDate: email.sendDate.toISOString(),
        subject: email.subject,
        body: email.body,
        source: email.source,
        platform: email.platform,
        hasResponded: email.hasResponded,
        contactResponse: email.contactResponse,
        respondedAt: email.respondedAt ? email.respondedAt.toISOString() : null,
        responseSubject: email.responseSubject,
        messageId: email.messageId,
        campaignId: email.campaignId,
        sequenceId: email.sequenceId,
        emailActivityId: email.emailActivityId,
        offPlatformSendId: email.offPlatformSendId,
        createdAt: email.createdAt.toISOString(),
        updatedAt: email.updatedAt.toISOString(),
        contact: email.contacts,
      },
    });
  } catch (error) {
    console.error('❌ Get email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch email',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/emails/[emailId]
 * Update an email record
 * 
 * Body: {
 *   subject?: string
 *   body?: string
 *   messageId?: string (SendGrid message ID after sending)
 *   emailActivityId?: string (link to email_activities)
 *   offPlatformSendId?: string (link to off_platform_email_sends)
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
    const {
      subject,
      body: emailBody,
      messageId,
      emailActivityId,
      offPlatformSendId,
    } = body ?? {};

    const updateData = {};
    if (subject !== undefined) updateData.subject = subject;
    if (emailBody !== undefined) updateData.body = emailBody;
    if (messageId !== undefined) updateData.messageId = messageId;
    if (emailActivityId !== undefined) updateData.emailActivityId = emailActivityId;
    if (offPlatformSendId !== undefined) updateData.offPlatformSendId = offPlatformSendId;

    const updatedEmail = await prisma.emails.update({
      where: { id: emailId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      email: {
        id: updatedEmail.id,
        subject: updatedEmail.subject,
        body: updatedEmail.body,
        messageId: updatedEmail.messageId,
        emailActivityId: updatedEmail.emailActivityId,
        offPlatformSendId: updatedEmail.offPlatformSendId,
      },
    });
  } catch (error) {
    console.error('❌ Update email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update email',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
