import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { snapContactLastContactedAt } from '@/lib/services/followUpCalculator';

/**
 * POST /api/contacts/[contactId]/off-platform-send
 * Track an off-platform email send (manual entry)
 * 
 * Body: {
 *   emailSent: string (ISO date string)
 *   subject?: string
 *   platform?: string (e.g., "gmail", "outlook", "apollo", "manual")
 *   notes?: string
 * }
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
    const { emailSent, subject, body: emailBody, platform, notes } = body ?? {};

    let emailSentDate = null;
    if (emailSent) {
      emailSentDate = new Date(emailSent);
      if (isNaN(emailSentDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid emailSent date format' },
          { status: 400 },
        );
      }
    }

    const isDraft = !emailSentDate;
    const bodyContent = emailBody && notes
      ? `BODY:\n${emailBody}\n\nNOTES:\n${notes}`
      : emailBody || notes || null;

    const activity = await prisma.email_activities.create({
      data: {
        owner_id: owner.id,
        contact_id: contactId,
        email: contact.email || '',
        subject: subject || null,
        body: bodyContent,
        event: isDraft ? null : 'sent',
        messageId: null,
        source: 'OFF_PLATFORM',
        platform: platform || 'manual',
        sentAt: emailSentDate,
      },
    });

    console.log(`✅ Off-platform email ${isDraft ? 'draft saved' : 'send tracked'}:`, activity.id);

    if (!isDraft && emailSentDate) {
      try {
        await snapContactLastContactedAt(contactId, emailSentDate);
      } catch (snapErr) {
        console.warn('⚠️ Could not snap lastContactedAt:', snapErr.message);
      }
    }

    if (!isDraft) {
      try {
        const pipe = await prisma.pipelines.findUnique({ where: { contactId } });
        if (pipe?.pipeline === 'prospect' && pipe?.stage === 'need-to-engage') {
          await prisma.pipelines.update({
            where: { contactId },
            data: { stage: 'engaged-awaiting-response', updatedAt: new Date() },
          });
          console.log('✅ Deal pipeline stage → engaged-awaiting-response for contact:', contactId);
        }
      } catch (pipeErr) {
        console.warn('⚠️ Could not update deal pipeline stage:', pipeErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      isDraft,
      offPlatformSend: {
        id: activity.id,
        contactId: contactId,
        emailSent: activity.sentAt?.toISOString() ?? null,
        isDraft,
        subject: activity.subject,
        platform: activity.platform,
        notes: activity.body,
        createdAt: activity.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Track off-platform send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track off-platform send',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/contacts/[contactId]/off-platform-send
 * Get all off-platform sends for a contact
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
    const { contactId } = resolvedParams || {};
    
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    const activities = await prisma.email_activities.findMany({
      where: {
        contact_id: contactId,
        source: 'OFF_PLATFORM',
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      offPlatformSends: activities.map(send => ({
        id: send.id,
        contactId: send.contact_id,
        emailSent: send.sentAt?.toISOString() ?? null,
        isDraft: !send.sentAt,
        subject: send.subject,
        platform: send.platform,
        notes: send.body,
        createdAt: send.createdAt.toISOString(),
        updatedAt: send.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('❌ Get off-platform sends error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch off-platform sends',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
