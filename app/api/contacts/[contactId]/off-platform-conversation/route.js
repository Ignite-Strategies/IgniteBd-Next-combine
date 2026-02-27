import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { snapContactLastContactedAt, computeAndPersistNextEngagement } from '@/lib/services/emailCadenceService';

/**
 * POST /api/contacts/[contactId]/off-platform-conversation
 * Save a full email thread as multiple email_activities (one per message).
 *
 * Body: {
 *   messages: Array<{ direction: 'outbound'|'inbound', subject?: string, body: string, sent?: string }>
 *   platform?: string
 * }
 * messages must be in chronological order (oldest first). First message should be outbound (our send).
 */
export async function POST(request, { params }) {
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

    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
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

    const body = await request.json();
    const { messages: rawMessages, platform } = body ?? {};

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messages array is required and must not be empty' },
        { status: 400 },
      );
    }

    const platformVal = platform || 'manual';
    let previousActivityId = null;
    const createdIds = [];
    let lastInboundSentAt = null;

    for (let i = 0; i < rawMessages.length; i++) {
      const msg = rawMessages[i];
      const direction = msg?.direction;
      const bodyContent = msg?.body ?? '';
      const subject = msg?.subject ?? null;
      let sentAt = null;
      if (msg?.sent) {
        sentAt = new Date(msg.sent);
        if (isNaN(sentAt.getTime())) sentAt = null;
      }

      const isOutbound = direction === 'outbound';
      const order = i === 0
        ? (isOutbound ? 'SENT' : 'CONTACT_RESPONDED')
        : (isOutbound ? 'OWNER_RESPONSE' : 'CONTACT_RESPONDED');

      if (order === 'CONTACT_RESPONDED' && sentAt) {
        lastInboundSentAt = sentAt;
      }

      const activity = await prisma.email_activities.create({
        data: {
          owner_id: owner.id,
          contact_id: contactId,
          email: contact.email || null,
          subject,
          body: bodyContent,
          event: 'sent',
          messageId: null,
          emailSequenceOrder: order,
          source: 'OFF_PLATFORM',
          platform: platformVal,
          sentAt,
        },
      });

      if (previousActivityId) {
        await prisma.email_activities.update({
          where: { id: previousActivityId },
          data: { responseFromEmail: activity.id },
        });
      }
      previousActivityId = activity.id;
      createdIds.push(activity.id);
    }

    // Update contact and cadence using last inbound (contact reply) if any
    if (lastInboundSentAt) {
      try {
        await prisma.contact.update({
          where: { id: contactId },
          data: { lastRespondedAt: lastInboundSentAt },
        });
        await computeAndPersistNextEngagement(contactId);
      } catch (e) {
        console.warn('⚠️ Could not update contact lastRespondedAt:', e?.message);
      }
    } else {
      const firstSent = rawMessages[0]?.sent ? new Date(rawMessages[0].sent) : null;
      if (firstSent && !isNaN(firstSent.getTime())) {
        try {
          await snapContactLastContactedAt(contactId, firstSent);
          await computeAndPersistNextEngagement(contactId);
        } catch (e) {
          console.warn('⚠️ Could not snap lastContactedAt:', e?.message);
        }
      }
    }

    console.log('✅ Off-platform conversation saved:', createdIds.length, 'messages');

    return NextResponse.json({
      success: true,
      activityIds: createdIds,
      messageCount: createdIds.length,
    });
  } catch (error) {
    console.error('❌ Off-platform conversation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save conversation',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
