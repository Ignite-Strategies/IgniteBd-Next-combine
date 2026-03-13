import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { universalEmailParser } from '@/lib/services/universalEmailParser';
import { interpretEngagement } from '@/lib/services/aiEngagementInterpreter';
import { generateMeetingSummaryService } from '@/lib/services/generateMeetingSummaryService';

/**
 * POST /api/inbound-parse/push-to-ai
 *
 * Record: Parse (universal) → Interpret (AI, once) → Log activity → Stamp engagement.
 * Accepts optional preInterpreted to avoid double AI when UI already ran interpret.
 *
 * Body: { inboundEmailId, contactEmail?, contactIdOverride?, nextEngagementDate?, interpretation? }
 *
 * contactIdOverride: if provided, skips email-based find-or-create and directly links
 * the specified contact. Used when the user selected a name-match candidate in the UI.
 *
 * Routes based on AI-detected activityType:
 *   call_note | meeting_note → creates a Meeting record (correct date, correct model)
 *   inbound_email | outbound_email | note → creates email_activities (existing path)
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
    const nextEngagementDateOverride =
      typeof body?.nextEngagementDate === 'string' && body.nextEngagementDate.trim()
        ? body.nextEngagementDate.trim()
        : null;
    const contactEmailOverride =
      typeof body?.contactEmail === 'string' && body.contactEmail.trim()
        ? body.contactEmail.trim()
        : null;
    const contactIdOverride =
      typeof body?.contactIdOverride === 'string' && body.contactIdOverride.trim()
        ? body.contactIdOverride.trim()
        : null;
    const preInterpreted = body?.interpretation ?? null;

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

    const companyHQId = inbound.companyHQId;
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'InboundEmail has no company' },
        { status: 400 }
      );
    }

    const company = inbound.company_hqs;
    const ownerId = company?.ownerId ?? company?.contactOwnerId ?? null;
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Company has no owner.' },
        { status: 400 }
      );
    }

    const owner = company?.owners_company_hqs_ownerIdToowners;
    const ownerContext = {
      name: owner?.name || null,
      email: owner?.email || null,
      companyName: company?.companyName || null,
    };

    // ── 1. Parse (universal, dumb) ──
    const parsed = universalEmailParser({
      from: inbound.from,
      to: inbound.to,
      subject: inbound.subject,
      text: inbound.text,
      html: inbound.html,
      email: inbound.email,
      headers: inbound.headers,
    });

    // ── 2. Interpret (AI, once — or use preInterpreted) ──
    // Re-interpret if preInterpreted is missing the new activityType field
    let interpreted = preInterpreted;
    if (
      !interpreted ||
      typeof interpreted !== 'object' ||
      !interpreted.activityType
    ) {
      interpreted = await interpretEngagement(
        {
          from: parsed.from,
          fromEmail: parsed.fromEmail,
          fromName: parsed.fromName,
          to: parsed.to,
          toEmail: parsed.toEmail,
          toName: parsed.toName,
          subject: parsed.subject,
          body: parsed.body,
          headers: parsed.headers,
          raw: parsed.raw,
        },
        ownerContext,
      );
    }

    const activityType = interpreted.activityType || 'inbound_email';
    const activityDate = interpreted.activityDate || null;

    const effectiveContactEmail =
      contactEmailOverride || interpreted.contactEmail;

    // ── 3. Contact find-or-create ──
    let contactId: string | null = null;

    if (contactIdOverride) {
      // User selected a name-match candidate in the UI — use directly, no lookup needed
      contactId = contactIdOverride;
      console.log(`✅ push-to-ai: using contactIdOverride ${contactId}`);
    } else if (effectiveContactEmail && companyHQId) {
      const normalizedEmail = effectiveContactEmail.trim().toLowerCase();
      const existing = await prisma.contact.findFirst({
        where: {
          crmId: companyHQId,
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) {
        contactId = existing.id;
      } else {
        const nameParts = (interpreted.contactName || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const newContact = await prisma.contact.create({
          data: {
            crmId: companyHQId,
            email: normalizedEmail,
            firstName: nameParts[0] || null,
            lastName: nameParts.slice(1).join(' ') || null,
          },
          select: { id: true },
        });
        contactId = newContact.id;
        console.log(`✅ push-to-ai: created new contact ${contactId} for ${normalizedEmail}`);
      }
    }

    const effectiveNextEngagementDate =
      nextEngagementDateOverride || interpreted.nextEngagementDate || null;

    // ── 4. Route by activity type ──
    const isMeetingOrCall =
      activityType === 'call_note' || activityType === 'meeting_note';

    let recordId: string;
    let recordType: string;

    if (isMeetingOrCall && contactId) {
      // ── 4a. Meeting/Call path — create a Meeting record ──
      const meetingDateParsed = activityDate
        ? new Date(activityDate)
        : inbound.createdAt;

      const meetingTypeMap: Record<string, string> = {
        call_note: 'CHECK_IN',
        meeting_note: 'FOLLOW_UP',
      };
      const meetingType = meetingTypeMap[activityType] || 'OTHER';

      const noteText =
        inbound.text || inbound.html?.replace(/<[^>]+>/g, ' ').trim() || null;

      const meeting = await prisma.meeting.create({
        data: {
          contactId,
          ownerId,
          crmId: companyHQId,
          meetingDate: meetingDateParsed,
          meetingType,
          notes: noteText,
          nextAction: interpreted.summary || null,
          nextEngagementDate: effectiveNextEngagementDate,
        },
      });

      // Generate meeting summary from notes
      if (noteText && noteText.length >= 20) {
        try {
          const summary = await generateMeetingSummaryService(noteText);
          if (summary) {
            await prisma.meeting.update({
              where: { id: meeting.id },
              data: { summary },
            });
          }
        } catch (err) {
          console.warn('⚠️ Meeting summary generation failed:', (err as Error)?.message);
        }
      }

      // Update contact engagement
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          lastEngagementDate: meetingDateParsed,
          lastEngagementType: 'MEETING',
          ...(effectiveNextEngagementDate
            ? {
                nextEngagementDate: effectiveNextEngagementDate,
                nextEngagementPurpose: 'MEETING_FOLLOW_UP',
              }
            : {}),
        },
      });

      recordId = meeting.id;
      recordType = activityType === 'call_note' ? 'Meeting (Call)' : 'Meeting';
      console.log(`✅ push-to-ai: created Meeting record ${recordId} for ${activityType}`);
    } else {
      // ── 4b. Email/Note path — create email_activities record ──

      // Determine correct direction from activityType
      const emailSequenceOrder =
        activityType === 'inbound_email'
          ? ('CONTACT_SEND' as const)
          : ('OWNER_SEND' as const);

      // Use extracted activity date for sentAt when available
      const sentAt = activityDate ? new Date(activityDate) : inbound.createdAt;

      const emailActivity = await prisma.email_activities.create({
        data: {
          owner_id: ownerId,
          contact_id: contactId,
          tenant_id: companyHQId,
          email: effectiveContactEmail || inbound.from || null,
          subject: interpreted.subject || inbound.subject || null,
          body: interpreted.body || null,
          event: activityType === 'inbound_email' ? 'received' : 'sent',
          source: 'OFF_PLATFORM',
          platform: 'sendgrid_inbound',
          emailSequenceOrder,
          emailRawText: inbound.text || inbound.html || inbound.email || null,
          summary: interpreted.summary || null,
          sentAt,
        },
      });

      // Stamp lastEngagementDate on contact
      if (contactId) {
        const engagementType =
          activityType === 'inbound_email' ? 'CONTACT_RESPONSE' : 'OUTBOUND_EMAIL';
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            lastEngagementDate: sentAt,
            lastEngagementType: engagementType,
          },
        });

        if (effectiveNextEngagementDate) {
          await prisma.contact.update({
            where: { id: contactId },
            data: { nextEngagementDate: effectiveNextEngagementDate },
          });
        }
      }

      recordId = emailActivity.id;
      recordType = 'EmailActivity';
    }

    // ── 5. Pipeline shift (for both paths) ──
    if (contactId) {
      try {
        const pipe = await prisma.pipelines.findUnique({
          where: { contactId },
        });
        if (pipe?.pipeline === 'prospect' && pipe?.stage === 'need-to-engage') {
          await prisma.pipelines.update({
            where: { contactId },
            data: { stage: 'engaged-awaiting-response', updatedAt: new Date() },
          });
          const { snapPipelineOnContact } = await import(
            '@/lib/services/pipelineService'
          );
          await snapPipelineOnContact(
            contactId,
            pipe.pipeline,
            'engaged-awaiting-response',
          );
        }
      } catch (e) {
        console.warn('⚠️ Pipeline shift skipped:', (e as Error)?.message);
      }
    }

    // ── 6. Mark ingested ──
    await prisma.inboundEmail.update({
      where: { id: inboundEmailId },
      data: { ingestionStatus: 'PROMOTED' },
    });

    return NextResponse.json({
      success: true,
      recordId,
      recordType,
      contactId,
      parsed: {
        contactEmail: effectiveContactEmail,
        contactName: interpreted.contactName,
        nextEngagementDate: effectiveNextEngagementDate,
        isResponse: interpreted.isResponse,
        summary: interpreted.summary,
        activityType,
        activityDate,
      },
    });
  } catch (error) {
    console.error('❌ Record activity error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to record activity',
      },
      { status: 500 }
    );
  }
}
