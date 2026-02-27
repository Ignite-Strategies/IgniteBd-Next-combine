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

    const activity = await prisma.email_activities.findUnique({
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

    if (!activity) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      email: {
        id: activity.id,
        contactId: activity.contact_id,
        sendDate: (activity.sentAt ?? activity.createdAt).toISOString(),
        subject: activity.subject,
        body: activity.body,
        source: activity.source,
        platform: activity.platform,
        hasResponded: activity.hasResponded,
        contactResponse: activity.contactResponse,
        respondedAt: activity.respondedAt ? activity.respondedAt.toISOString() : null,
        responseSubject: activity.responseSubject,
        messageId: activity.messageId,
        campaignId: activity.campaign_id,
        sequenceId: activity.sequence_id,
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
        contact: activity.contacts,
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
 *   sentAt?: string (ISO date; only for OFF_PLATFORM)
 *   platform?: string (e.g. "linkedin", "email"; only for OFF_PLATFORM)
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

    const activity = await prisma.email_activities.findUnique({
      where: { id: emailId },
    });

    if (!activity) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { subject, body: emailBody, messageId, sentAt, platform } = body ?? {};

    const updateData = {};
    if (subject !== undefined) updateData.subject = subject;
    if (emailBody !== undefined) updateData.body = emailBody;
    if (messageId !== undefined) updateData.messageId = messageId;

    // Only allow sentAt/platform for off-platform records (edit manual/LinkedIn etc.)
    if (activity.source === 'OFF_PLATFORM') {
      if (sentAt !== undefined) {
        const d = new Date(sentAt);
        updateData.sentAt = isNaN(d.getTime()) ? null : d;
      }
      if (platform !== undefined) updateData.platform = platform || null;
    }

    const updated = await prisma.email_activities.update({
      where: { id: emailId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      email: {
        id: updated.id,
        subject: updated.subject,
        body: updated.body,
        messageId: updated.messageId,
        sentAt: updated.sentAt?.toISOString?.() ?? null,
        platform: updated.platform,
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
