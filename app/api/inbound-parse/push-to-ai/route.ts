import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { takeCrmClientEmailAndParseAiService } from '@/lib/services/takeCrmClientEmailAndParseAiService';
import { stampLastEngagement } from '@/lib/services/emailCadenceService';

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
 * Ingest: Parse → log activity (with summary) → stamp lastEngagementDate → pipeline shift.
 * Does NOT auto-compute nextEngagementDate — that's a separate action ("Calculate Engagement").
 * DOES set nextEngagementDate if the AI parsed one or user overrode one.
 *
 * Body: { inboundEmailId, contactEmail?, nextEngagementDate? }
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
    const contactEmailOverride = typeof body?.contactEmail === 'string' && body.contactEmail.trim()
      ? body.contactEmail.trim()
      : null;

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
      return NextResponse.json({ success: false, error: 'InboundEmail not found' }, { status: 404 });
    }

    const companyHQId = inbound.companyHQId;
    if (!companyHQId) {
      return NextResponse.json({ success: false, error: 'InboundEmail has no company' }, { status: 400 });
    }

    const company = inbound.company_hqs;
    const ownerId = company?.ownerId ?? company?.contactOwnerId ?? null;
    if (!ownerId) {
      return NextResponse.json({ success: false, error: 'Company has no owner.' }, { status: 400 });
    }

    // ── 1. AI Parse ──
    const parseInput = buildParseInput({ text: inbound.text, html: inbound.html, email: inbound.email });
    const owner = company?.owners_company_hqs_ownerIdToowners;
    const parsed = await takeCrmClientEmailAndParseAiService(
      parseInput,
      inbound.headers ?? undefined,
      { name: owner?.name || null, email: owner?.email || null, companyName: company?.companyName || null },
    );

    const effectiveContactEmail = contactEmailOverride || parsed.contactEmail;

    // ── 2. Contact find-or-create (never orphan an activity) ──
    let contactId: string | null = null;
    if (effectiveContactEmail && companyHQId) {
      const normalizedEmail = effectiveContactEmail.trim().toLowerCase();
      const existing = await prisma.contact.findFirst({
        where: { crmId: companyHQId, email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        contactId = existing.id;
      } else {
        // Parse name from AI result or from email
        const nameParts = parsed.contactName?.trim().split(/\s+/) ?? [];
        const newContact = await prisma.contact.create({
          data: {
            crmId: companyHQId,
            email: normalizedEmail,
            firstName: nameParts[0] || null,
            lastName: nameParts.slice(1).join(' ') || null,
            companyName: parsed.contactCompany || null,
            title: parsed.contactTitle || null,
          },
          select: { id: true },
        });
        contactId = newContact.id;
        console.log(`✅ push-to-ai: created new contact ${contactId} for ${normalizedEmail}`);
      }
    }

    // ── 3. Log Activity (with summary) ──
    const emailActivity = await prisma.email_activities.create({
      data: {
        owner_id: ownerId,
        contact_id: contactId,
        tenant_id: companyHQId,
        email: effectiveContactEmail || inbound.from || null,
        subject: parsed.subject || inbound.subject || null,
        body: parsed.body || null,
        event: 'received',
        source: 'OFF_PLATFORM',
        platform: 'sendgrid_inbound',
        emailRawText: inbound.text || inbound.html || inbound.email || null,
        summary: parsed.summary || null,
        sentAt: inbound.createdAt,
      },
    });

    // ── 4. Stamp lastEngagementDate ──
    const engagementType = parsed.isResponse ? 'CONTACT_RESPONSE' : 'OUTBOUND_EMAIL';
    if (contactId) {
      await stampLastEngagement(contactId, inbound.createdAt, engagementType);
    }

    // ── 5. nextEngagementDate (only if AI parsed one or user overrode) ──
    const effectiveNextEngagementDate = nextEngagementDateOverride || parsed.nextEngagementDate || null;
    if (contactId && effectiveNextEngagementDate) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { nextEngagementDate: effectiveNextEngagementDate },
      });
    }

    // ── 6. Pipeline shift: prospect/need-to-engage → engaged-awaiting-response ──
    if (contactId) {
      try {
        const pipe = await prisma.pipelines.findUnique({ where: { contactId } });
        if (pipe?.pipeline === 'prospect' && pipe?.stage === 'need-to-engage') {
          await prisma.pipelines.update({
            where: { contactId },
            data: { stage: 'engaged-awaiting-response', updatedAt: new Date() },
          });
          const { snapPipelineOnContact } = await import('@/lib/services/pipelineService');
          await snapPipelineOnContact(contactId, pipe.pipeline, 'engaged-awaiting-response');
        }
      } catch (e) {
        console.warn('⚠️ Pipeline shift skipped:', (e as Error)?.message);
      }
    }

    // ── 7. Mark ingested ──
    await prisma.inboundEmail.update({
      where: { id: inboundEmailId },
      data: { ingestionStatus: 'PROMOTED' },
    });

    return NextResponse.json({
      success: true,
      emailActivityId: emailActivity.id,
      contactId,
      parsed: {
        contactEmail: effectiveContactEmail,
        contactName: parsed.contactName,
        nextEngagementDate: effectiveNextEngagementDate,
        isResponse: parsed.isResponse,
        summary: parsed.summary,
      },
    });
  } catch (error) {
    console.error('❌ Record activity error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to record activity' },
      { status: 500 }
    );
  }
}
