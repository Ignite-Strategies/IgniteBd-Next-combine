import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/emails
 * Create a new email record (before sending)
 * This allows the compose UX to create the email first, then reference it by ID when sending
 * 
 * Body: {
 *   contactId: string (required)
 *   subject?: string
 *   body?: string
 *   source: "PLATFORM" | "OFF_PLATFORM"
 *   platform?: string
 *   sendDate?: string (ISO, defaults to now)
 *   campaignId?: string
 *   sequenceId?: string
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
    const payload = await request.json();
    const {
      contactId,
      subject,
      body: bodyText,
      source,
      platform,
      sendDate,
      campaignId,
      sequenceId,
    } = payload ?? {};

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!source || (source !== 'PLATFORM' && source !== 'OFF_PLATFORM')) {
      return NextResponse.json(
        { success: false, error: 'source must be PLATFORM or OFF_PLATFORM' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Parse sendDate or use now
    const emailSendDate = sendDate ? new Date(sendDate) : new Date();
    if (isNaN(emailSendDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid sendDate format' },
        { status: 400 },
      );
    }

    // Create email record
    const email = await prisma.emails.create({
      data: {
        contactId,
        sendDate: emailSendDate,
        subject: subject || null,
        body: bodyText || null,
        source: source,
        platform: platform || null,
        campaignId: campaignId || null,
        sequenceId: sequenceId || null,
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

    // Update contact pipeline status to ENGAGED_AWAITING_RESPONSE if currently NEED_TO_ENGAGE
    if (email.contacts?.outreachPipelineStatus === 'NEED_TO_ENGAGE') {
      await prisma.contact.update({
        where: { id: contactId },
        data: { outreachPipelineStatus: 'ENGAGED_AWAITING_RESPONSE' },
      }).catch(err => {
        console.warn('Failed to update pipeline status:', err);
        // Don't fail the request if status update fails
      });
    }

    console.log('✅ Email record created:', email.id);

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
        createdAt: email.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Create email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create email record',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/emails
 * Get emails with optional filters
 * 
 * Query params:
 *   - contactId?: string
 *   - hasResponded?: boolean
 *   - source?: PLATFORM | OFF_PLATFORM
 *   - limit?: number (default: 50)
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const hasResponded = searchParams.get('hasResponded');
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where = {};
    if (contactId) where.contactId = contactId;
    if (hasResponded !== null) where.hasResponded = hasResponded === 'true';
    if (source) where.source = source;

    const emails = await prisma.emails.findMany({
      where,
      orderBy: { sendDate: 'desc' },
      take: limit,
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

    return NextResponse.json({
      success: true,
      emails: emails.map(email => ({
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
        createdAt: email.createdAt.toISOString(),
        contact: email.contacts,
      })),
      count: emails.length,
    });
  } catch (error) {
    console.error('❌ Get emails error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch emails',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
