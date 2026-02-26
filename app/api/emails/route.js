import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { snapContactLastContactedAt } from '@/lib/services/emailCadenceService';

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
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

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

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const emailSendDate = sendDate ? new Date(sendDate) : new Date();
    if (isNaN(emailSendDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid sendDate format' },
        { status: 400 },
      );
    }

    const activity = await prisma.email_activities.create({
      data: {
        owner_id: owner.id,
        contact_id: contactId,
        email: contact.email || '',
        subject: subject || null,
        body: bodyText || null,
        event: null,
        messageId: null,
        source,
        platform: platform || null,
        sentAt: emailSendDate,
        campaign_id: campaignId || null,
        sequence_id: sequenceId || null,
      },
    });

    try {
      await snapContactLastContactedAt(contactId, emailSendDate);
    } catch (snapErr) {
      console.warn('⚠️ Could not snap lastContactedAt:', snapErr.message);
    }

    console.log('✅ Email activity created:', activity.id);

    return NextResponse.json({
      success: true,
      email: {
        id: activity.id,
        contactId: contactId,
        sendDate: (activity.sentAt ?? activity.createdAt).toISOString(),
        subject: activity.subject,
        body: activity.body,
        source: activity.source,
        platform: activity.platform,
        hasResponded: activity.hasResponded,
        createdAt: activity.createdAt.toISOString(),
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
    if (contactId) where.contact_id = contactId;
    if (hasResponded === 'true' || hasResponded === 'false') where.hasResponded = hasResponded === 'true';
    if (source) where.source = source;

    const activities = await prisma.email_activities.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
      emails: activities.map(a => ({
        id: a.id,
        contactId: a.contact_id,
        sendDate: (a.sentAt ?? a.createdAt).toISOString(),
        subject: a.subject,
        body: a.body,
        source: a.source,
        platform: a.platform,
        hasResponded: a.hasResponded,
        contactResponse: a.contactResponse,
        respondedAt: a.respondedAt ? a.respondedAt.toISOString() : null,
        responseSubject: a.responseSubject,
        messageId: a.messageId,
        campaignId: a.campaign_id,
        createdAt: a.createdAt.toISOString(),
        contact: a.contacts,
      })),
      count: activities.length,
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
