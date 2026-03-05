import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { takeCrmClientEmailAndParseAiService } from '@/lib/services/takeCrmClientEmailAndParseAiService';

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
 * POST /api/inbound-parse/parse
 *
 * 4-step parse pipeline (read-only, no writes):
 *   1. AI parse → extract contact, subject, body, nextEngagementDate
 *   2. Contact lookup → find matching contact record
 *   3. Email history → pull existing activities for that contact
 *   4. Next engage context → current nextEngagementDate on contact + AI suggestion
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
    if (!inboundEmailId || typeof inboundEmailId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing inboundEmailId' },
        { status: 400 }
      );
    }

    const inbound = await prisma.inboundEmail.findUnique({
      where: { id: inboundEmailId },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
            ownerId: true,
            contactOwnerId: true,
            owners_company_hqs_ownerIdToowners: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!inbound) {
      return NextResponse.json(
        { success: false, error: 'InboundEmail not found' },
        { status: 404 }
      );
    }

    const company = inbound.company_hqs;
    const companyHQId = inbound.companyHQId;
    const owner = company?.owners_company_hqs_ownerIdToowners;
    const ownerContext = {
      name: owner?.name || null,
      email: owner?.email || null,
      companyName: company?.companyName || null,
    };

    // ── Step 1: AI Parse ──
    const parseInput = buildParseInput({
      text: inbound.text,
      html: inbound.html,
      email: inbound.email,
    });

    const parsed = await takeCrmClientEmailAndParseAiService(
      parseInput,
      inbound.headers ?? undefined,
      ownerContext,
    );

    // ── Step 2: Contact Lookup ──
    let contact: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      company: string | null;
      title: string | null;
      pipeline: string | null;
      nextEngagementDate: string | null;
      nextEngagementPurpose: string | null;
      lastEngagementDate: Date | null;
      lastEngagementType: string | null;
      doNotContactAgain: boolean;
    } | null = null;

    if (parsed.contactEmail && companyHQId) {
      const found = await prisma.contact.findFirst({
        where: {
          crmId: companyHQId,
          email: { equals: parsed.contactEmail, mode: 'insensitive' as const },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true,
          title: true,
          pipeline: true,
          nextEngagementDate: true,
          nextEngagementPurpose: true,
          lastEngagementDate: true,
          lastEngagementType: true,
          doNotContactAgain: true,
        },
      });
      if (found) {
        contact = found;
      }
    }

    // ── Step 3: Email History (if contact found) ──
    let emailHistory: Array<{
      id: string;
      date: string;
      subject: string | null;
      body: string | null;
      type: string;
      platform: string | null;
      event: string | null;
      hasResponse: boolean;
    }> = [];
    let alreadyIngested = false;

    if (contact) {
      const activities = await prisma.email_activities.findMany({
        where: { contact_id: contact.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          sentAt: true,
          subject: true,
          body: true,
          source: true,
          platform: true,
          event: true,
          emailSequenceOrder: true,
          responseFromEmail: true,
        },
      });

      emailHistory = activities.map((a) => ({
        id: a.id,
        date: (a.sentAt ?? a.createdAt).toISOString(),
        subject: a.subject,
        body: a.body ? (a.body.length > 150 ? a.body.slice(0, 150) + '…' : a.body) : null,
        type: a.source === 'OFF_PLATFORM' ? 'off-platform' : 'platform',
        platform: a.platform,
        event: a.event,
        direction: a.emailSequenceOrder === 'CONTACT_SEND' ? 'inbound' : 'outbound',
        hasResponse: !!a.responseFromEmail,
      }));

      // Duplicate detection: check if an activity with same subject + similar date exists
      const parsedSubject = (parsed.subject || '').toLowerCase().replace(/^re:\s*/i, '').trim();
      if (parsedSubject) {
        alreadyIngested = activities.some((a) => {
          const existingSubject = (a.subject || '').toLowerCase().replace(/^re:\s*/i, '').trim();
          return existingSubject === parsedSubject && a.platform === 'sendgrid_inbound';
        });
      }
    }

    // ── Step 4: Next Engage Context ──
    const currentNextEngage = contact?.nextEngagementDate || null;
    const aiSuggestedNextEngage = parsed.nextEngagementDate || null;
    let defaultNextEngage: string | null = null;
    if (!aiSuggestedNextEngage && parsed.isResponse) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      defaultNextEngage = d.toISOString().slice(0, 10);
    }

    return NextResponse.json({
      success: true,
      // Step 1
      parsed: {
        contactEmail: parsed.contactEmail,
        contactName: parsed.contactName,
        subject: parsed.subject,
        body: parsed.body,
        isResponse: parsed.isResponse,
        summary: parsed.summary,
      },
      // Step 2
      contact: contact
        ? {
            id: contact.id,
            name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
            email: contact.email,
            company: contact.company,
            title: contact.title,
            pipeline: contact.pipeline,
            doNotContactAgain: contact.doNotContactAgain,
          }
        : null,
      // Step 3
      emailHistory,
      alreadyIngested,
      // Step 4
      nextEngage: {
        aiSuggested: aiSuggestedNextEngage,
        responseDefault: defaultNextEngage,
        currentOnContact: currentNextEngage,
        currentPurpose: contact?.nextEngagementPurpose || null,
        recommended: aiSuggestedNextEngage || defaultNextEngage || currentNextEngage,
      },
    });
  } catch (error) {
    console.error('❌ Parse pipeline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse email',
      },
      { status: 500 }
    );
  }
}
