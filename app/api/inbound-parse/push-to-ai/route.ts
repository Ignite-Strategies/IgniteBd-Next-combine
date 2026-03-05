import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { takeCrmClientEmailAndParseAiService } from '@/lib/services/takeCrmClientEmailAndParseAiService';

/** Build input for AI parser: pass text + html when both exist for better contact name extraction */
function buildParseInput(inbound: {
  text: string | null;
  html: string | null;
  email: string | null;
}) {
  const text = inbound.text?.trim() || null;
  const html = inbound.html?.trim() || null;
  const raw = inbound.email?.trim() || null;
  if (!text && !html && !raw) {
    throw new Error('No content to parse (text, html, and email are all empty)');
  }
  return { text, html, raw };
}

/**
 * POST /api/inbound-parse/push-to-ai
 *
 * Take an InboundEmail, parse with AI, create EmailActivity.
 * Body: { inboundEmailId: string }
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const inboundEmailId = body?.inboundEmailId;
    const nextEngagementDateOverride = typeof body?.nextEngagementDate === 'string' && body.nextEngagementDate.trim()
      ? body.nextEngagementDate.trim()
      : null;

    if (!inboundEmailId || typeof inboundEmailId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing inboundEmailId' },
        { status: 400 }
      );
    }

    const inbound = await prisma.inboundEmail.findUnique({
      where: { id: inboundEmailId },
      include: { company_hqs: { select: { id: true, ownerId: true, contactOwnerId: true } } },
    });

    if (!inbound) {
      return NextResponse.json(
        { success: false, error: 'InboundEmail not found' },
        { status: 404 }
      );
    }

    const companyHQId = inbound.companyHQId;
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'InboundEmail has no company (companyHQId)' },
        { status: 400 }
      );
    }

    const company = inbound.company_hqs;
    const ownerId = company?.ownerId ?? company?.contactOwnerId ?? null;
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Company has no owner. Set owner on company settings.' },
        { status: 400 }
      );
    }

    const parseInput = buildParseInput({
      text: inbound.text,
      html: inbound.html,
      email: inbound.email,
    });

    const parsed = await takeCrmClientEmailAndParseAiService(
      parseInput,
      inbound.headers ?? undefined
    );

    // Surface contact name in body for human pairing (email_activities has no contactName column)
    const bodyWithParsedMeta =
      parsed.contactName || parsed.contactEmail
        ? `[Parsed: ${parsed.contactName || '?'} <${parsed.contactEmail || '?'}>]\n\n${parsed.body || ''}`
        : parsed.body || null;

    // Determine effective nextEngagementDate: user override > AI parsed > default for responses
    const parsedDate = parsed.nextEngagementDate || null;
    let effectiveNextEngagementDate = nextEngagementDateOverride || parsedDate;

    // Look up contact by email in this company
    let contactId: string | null = null;
    if (parsed.contactEmail) {
      const contact = await prisma.contact.findFirst({
        where: {
          crmId: companyHQId,
          email: { equals: parsed.contactEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (contact) {
        contactId = contact.id;
        // Default to 1 week from now for responses when no date parsed/override
        if (!effectiveNextEngagementDate && parsed.isResponse) {
          const oneWeekFromNow = new Date();
          oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
          effectiveNextEngagementDate = oneWeekFromNow.toISOString().slice(0, 10); // "YYYY-MM-DD"
        }
        if (effectiveNextEngagementDate) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { nextEngagementDate: effectiveNextEngagementDate },
          });
        }
      }
    }

    const emailActivity = await prisma.email_activities.create({
      data: {
        owner_id: ownerId,
        contact_id: contactId, // null when no match — human can pair later
        tenant_id: companyHQId,
        email: parsed.contactEmail || inbound.from || null,
        subject: parsed.subject || inbound.subject || null,
        body: bodyWithParsedMeta,
        event: 'received',
        emailSequenceOrder: 'CONTACT_SEND',
        source: 'OFF_PLATFORM',
        platform: 'sendgrid_inbound',
        emailRawText: inbound.text || inbound.html || inbound.email || null,
        sentAt: inbound.createdAt,
      },
    });

    // Update InboundEmail status
    await prisma.inboundEmail.update({
      where: { id: inboundEmailId },
      data: { ingestionStatus: 'PROMOTED' },
    });

    return NextResponse.json({
      success: true,
      emailActivityId: emailActivity.id,
      parsed: {
        contactEmail: parsed.contactEmail,
        contactName: parsed.contactName,
        nextEngagementDate: effectiveNextEngagementDate,
        isResponse: parsed.isResponse,
      },
    });
  } catch (error) {
    console.error('❌ Push to AI error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push to AI',
      },
      { status: 500 }
    );
  }
}
