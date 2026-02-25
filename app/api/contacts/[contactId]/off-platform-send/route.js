import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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

    const body = await request.json();
    const { emailSent, subject, body: emailBody, platform, notes } = body ?? {};

    // emailSent is now optional — null/omitted means this is a saved draft
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

    // Combine body + notes into notes field
    let notesField = null;
    if (emailBody && notes) {
      notesField = `BODY:\n${emailBody}\n\nNOTES:\n${notes}`;
    } else if (emailBody) {
      notesField = emailBody;
    } else if (notes) {
      notesField = notes;
    }
    
    const offPlatformSend = await prisma.off_platform_email_sends.create({
      data: {
        contactId,
        emailSent: emailSentDate, // null = draft
        subject: subject || null,
        platform: platform || null,
        notes: notesField,
      },
    });

    console.log(`✅ Off-platform email ${isDraft ? 'draft saved' : 'send tracked'}:`, offPlatformSend.id);

    // Only advance pipeline stage on actual sends (not drafts)
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
        id: offPlatformSend.id,
        contactId: offPlatformSend.contactId,
        emailSent: offPlatformSend.emailSent?.toISOString() ?? null,
        isDraft,
        subject: offPlatformSend.subject,
        platform: offPlatformSend.platform,
        notes: offPlatformSend.notes,
        createdAt: offPlatformSend.createdAt.toISOString(),
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

    const offPlatformSends = await prisma.off_platform_email_sends.findMany({
      where: { contactId },
      orderBy: { emailSent: 'desc' },
    });

    return NextResponse.json({
      success: true,
      offPlatformSends: offPlatformSends.map(send => ({
        id: send.id,
        contactId: send.contactId,
        emailSent: send.emailSent?.toISOString() ?? null,
        isDraft: !send.emailSent,
        subject: send.subject,
        platform: send.platform,
        notes: send.notes,
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
