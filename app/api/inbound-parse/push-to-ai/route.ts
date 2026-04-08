import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { universalEmailParser } from '@/lib/services/universalEmailParser';
import { interpretEngagement } from '@/lib/services/aiEngagementInterpreter';
import {
  NEXT_ENGAGEMENT_PURPOSE_SCHEDULED_MEETING,
  isValidNextEngagementPurpose,
  normalizeAiNextEngagementPurpose,
} from '@/lib/constants/nextEngagementPurpose';
import { generateMeetingSummaryService } from '@/lib/services/generateMeetingSummaryService';
import { syncEmailSummaryToLog } from '@/lib/services/emailToLogService';
import {
  bumpProspectNeedToEngageToEngaged,
  resolveOutreachContactIdForWave1,
} from '@/lib/services/inboundProspectBump';
import {
  applyInboundPipelineMatchProposal,
  suggestInboundPipelineMatch,
} from '@/lib/services/inboundPipelineMatchService';
import { coerceNextEngagementPurposeForPostgres } from '@/lib/services/nextEngagementPurposeDb';

/**
 * POST /api/inbound-parse/push-to-ai
 *
 * Record: Parse (universal) → Interpret (AI, once) → Log activity → Stamp engagement.
 * Accepts optional preInterpreted to avoid double AI when UI already ran interpret.
 *
 * Body: { inboundEmailId, contactEmail?, contactIdOverride?, nextEngagementDate?, nextEngagementPurpose?, interpretation?, generatePipelineMatch?, applyPipelineMatch? }
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
    const nextEngagementPurposeTopLevel =
      typeof body?.nextEngagementPurpose === 'string' && body.nextEngagementPurpose.trim()
        ? body.nextEngagementPurpose.trim()
        : null;
    const preInterpreted = body?.interpretation ?? null;
    const generatePipelineMatch = body?.generatePipelineMatch === true;
    const applyPipelineMatch = body?.applyPipelineMatch === true;
    const updateContactProfile = body?.updateContactProfile === true;

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

    const ownerEmailLower = (owner?.email || '').toLowerCase().trim() || null;

    // Wave 1 — need-to-engage → engaged-awaiting-response (no interpret gate)
    try {
      if (contactIdOverride) {
        await bumpProspectNeedToEngageToEngaged(contactIdOverride);
      } else {
        const preId = await resolveOutreachContactIdForWave1({
          companyHQId,
          ownerEmailLower,
          fromEmail: parsed.fromEmail,
          toEmail: parsed.toEmail,
        });
        if (preId) {
          await bumpProspectNeedToEngageToEngaged(preId);
        }
      }
    } catch (bumpErr) {
      console.warn('⚠️ Wave1 prospect bump (pre-interpret):', (bumpErr as Error)?.message);
    }

    // ── 2. Interpret (AI, once — or use preInterpreted) ──
    // Re-interpret if preInterpreted is missing activityType or nextEngagementPurpose key (old clients)
    let interpreted = preInterpreted;
    const interpretationComplete =
      interpreted &&
      typeof interpreted === 'object' &&
      'activityType' in interpreted &&
      'nextEngagementPurpose' in interpreted;
    if (!interpretationComplete) {
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
      }
      // If no match: leave contactId null. email_activities.email is persisted for later link-by-email.
    }

    try {
      if (contactId) {
        await bumpProspectNeedToEngageToEngaged(contactId);
      }
    } catch (bump2) {
      console.warn('⚠️ Wave1 prospect bump (post-resolve):', (bump2 as Error)?.message);
    }

    const effectiveNextEngagementDate =
      nextEngagementDateOverride || interpreted.nextEngagementDate || null;

    const purposeFromInterpretation = normalizeAiNextEngagementPurpose(
      (interpreted as { nextEngagementPurpose?: unknown }).nextEngagementPurpose,
    );
    const purposeFromBodyTop = normalizeAiNextEngagementPurpose(nextEngagementPurposeTopLevel);
    let effectiveNextEngagementPurpose =
      purposeFromBodyTop || purposeFromInterpretation || null;

    if (
      effectiveNextEngagementPurpose &&
      !isValidNextEngagementPurpose(effectiveNextEngagementPurpose)
    ) {
      effectiveNextEngagementPurpose = null;
    }

    if (effectiveNextEngagementDate && !effectiveNextEngagementPurpose) {
      effectiveNextEngagementPurpose =
        activityType === 'inbound_email'
          ? 'POST_WARM_MEETING_NUDGE'
          : 'GENERAL_CHECK_IN';
    }

    const isScheduledMeetingPurpose =
      effectiveNextEngagementPurpose === NEXT_ENGAGEMENT_PURPOSE_SCHEDULED_MEETING &&
      !!effectiveNextEngagementDate;

    const purposeForContactEmailPath = effectiveNextEngagementPurpose
      ? await coerceNextEngagementPurposeForPostgres(prisma, effectiveNextEngagementPurpose)
      : null;

    let nextEngagementPurposeForResponse: string | null = purposeForContactEmailPath;

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

      const meetingFollowUpPurpose = await coerceNextEngagementPurposeForPostgres(
        prisma,
        'MEETING_FOLLOW_UP',
      );
      nextEngagementPurposeForResponse = meetingFollowUpPurpose;

      // Update contact engagement
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          lastEngagementDate: meetingDateParsed,
          lastEngagementType: 'MEETING',
          ...(effectiveNextEngagementDate
            ? {
                nextEngagementDate: effectiveNextEngagementDate,
                ...(meetingFollowUpPurpose
                  ? { nextEngagementPurpose: meetingFollowUpPurpose }
                  : {}),
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

        if (effectiveNextEngagementDate && purposeForContactEmailPath) {
          await prisma.contact.update({
            where: { id: contactId },
            data: {
              nextEngagementDate: effectiveNextEngagementDate,
              nextEngagementPurpose: purposeForContactEmailPath,
            },
          });
        } else {
          // Contact responded but no new next-engage date: clear stale next engagement if it's in the past
          const contactRow = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { nextEngagementDate: true },
          });
          const nextStr = contactRow?.nextEngagementDate;
          const nextDate = nextStr ? new Date(nextStr) : null;
          if (nextDate && nextDate < sentAt) {
            await prisma.contact.update({
              where: { id: contactId },
              data: { nextEngagementDate: null, nextEngagementPurpose: null },
            });
          }
        }

        if (updateContactProfile) {
          const rawProfEmail = (
            typeof body?.newContactEmail === 'string' && body.newContactEmail.trim()
              ? body.newContactEmail
              : effectiveContactEmail || ''
          )
            .trim()
            .toLowerCase();
          if (rawProfEmail.includes('@')) {
            const at = rawProfEmail.indexOf('@');
            const derivedDomain = at > 0 ? rawProfEmail.slice(at + 1) : null;
            const explicitCompany =
              typeof body?.newCompanyName === 'string' && body.newCompanyName.trim()
                ? body.newCompanyName.trim()
                : null;
            const fromInterpretation =
              typeof (interpreted as { contactCompany?: unknown }).contactCompany ===
                'string' && (interpreted as { contactCompany: string }).contactCompany.trim()
                ? (interpreted as { contactCompany: string }).contactCompany.trim()
                : null;
            const resolvedCompanyName = explicitCompany || fromInterpretation;

            await prisma.contact.update({
              where: { id: contactId },
              data: {
                email: rawProfEmail,
                ...(resolvedCompanyName ? { companyName: resolvedCompanyName } : {}),
                ...(derivedDomain ? { companyDomain: derivedDomain } : {}),
                recentJobChange: true,
                numberOfJobChanges: { increment: 1 },
              },
            });
          }
        }
      }

      // Scheduled meeting from inbound — create Meeting row for /meetings upcoming (deduped)
      if (
        contactId &&
        isScheduledMeetingPurpose &&
        activityType === 'inbound_email' &&
        effectiveNextEngagementDate
      ) {
        const dateStr = effectiveNextEngagementDate.slice(0, 10);
        const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
        const existingMeet = await prisma.meeting.findFirst({
          where: {
            contactId,
            meetingDate: { gte: dayStart, lte: dayEnd },
          },
          select: { id: true },
        });
        if (!existingMeet) {
          const noteText =
            inbound.text || inbound.html?.replace(/<[^>]+>/g, ' ').trim() || null;
          const meetingDateParsed = new Date(`${dateStr}T12:00:00.000Z`);
          const m = await prisma.meeting.create({
            data: {
              contactId,
              ownerId,
              crmId: companyHQId,
              meetingDate: meetingDateParsed,
              meetingType: 'FOLLOW_UP',
              notes: noteText,
              nextAction: interpreted.summary || null,
              nextEngagementDate: effectiveNextEngagementDate,
            },
          });
          if (noteText && noteText.length >= 20) {
            try {
              const summary = await generateMeetingSummaryService(noteText);
              if (summary) {
                await prisma.meeting.update({
                  where: { id: m.id },
                  data: { summary },
                });
              }
            } catch (err) {
              console.warn(
                '⚠️ Meeting summary generation failed:',
                (err as Error)?.message,
              );
            }
          }
          console.log(`✅ push-to-ai: created Meeting ${m.id} from scheduled-meeting detect`);
        }
      }

      // Silent template save on outbound ingest: when we record an owner-sent email, save as template with contact's persona
      if (
        activityType === 'outbound_email' &&
        contactId &&
        (interpreted.subject?.trim() || interpreted.body?.trim()) &&
        (interpreted.body?.trim()?.length ?? 0) >= 20
      ) {
        try {
          const contactRow = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { outreachPersonaSlug: true },
          });
          const subject = (interpreted.subject || inbound.subject || 'No subject').trim();
          const body = (interpreted.body || '').trim();
          await prisma.templates.create({
            data: {
              companyHQId,
              ownerId,
              title: subject.slice(0, 200) || 'From inbound',
              subject,
              body,
              ...(contactRow?.outreachPersonaSlug
                ? { personaSlug: contactRow.outreachPersonaSlug }
                : {}),
            },
          });
        } catch (templateErr) {
          console.warn('⚠️ push-to-ai: template save skipped:', (templateErr as Error)?.message);
        }
      }

      // Bridge email summary → engagement log (fire-and-forget)
      if (interpreted.summary && contactId) {
        syncEmailSummaryToLog(emailActivity.id).catch(() => {});
      }

      recordId = emailActivity.id;
      recordType = 'EmailActivity';
    }

    // ── 5. Pipeline — scheduled meeting → prospect/meeting (wave-1 bump already applied above)
    let pipe = contactId
      ? await prisma.pipelines.findUnique({ where: { contactId } })
      : null;
    if (contactId) {
      try {
        const { snapPipelineOnContact } = await import(
          '@/lib/services/pipelineService'
        );
        if (isScheduledMeetingPurpose) {
          const contactQuick = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { contactDisposition: true },
          });
          const allowedStages = ['interest', 'engaged-awaiting-response'];
          if (
            pipe?.pipeline === 'prospect' &&
            pipe.stage &&
            allowedStages.includes(pipe.stage) &&
            contactQuick?.contactDisposition !== 'OPTED_OUT'
          ) {
            await prisma.pipelines.update({
              where: { contactId },
              data: { stage: 'meeting', updatedAt: new Date() },
            });
            await snapPipelineOnContact(contactId, pipe.pipeline, 'meeting');
            pipe = { ...pipe, stage: 'meeting' };
            console.log('✅ push-to-ai: prospect pipeline → meeting (scheduled)');
          }
        }
      } catch (e) {
        console.warn('⚠️ Pipeline shift skipped:', (e as Error)?.message);
      }
    }

    // ── 5b. Optional pipeline match (referral / connector) — second service
    let pipelineMatch: {
      signals: import('@/lib/services/inboundPipelineMatchService').InboundPipelineMatchSignals;
      proposal: import('@/lib/services/inboundPipelineMatchService').InboundPipelineMatchProposal | null;
      applied: boolean;
    } | null = null;

    if (contactId && generatePipelineMatch) {
      try {
        const hasSchedFlag =
          isScheduledMeetingPurpose && activityType === 'inbound_email';
        const match = await suggestInboundPipelineMatch({
          contactId,
          engagement: {
            activityType,
            summary: interpreted.summary || '',
            hasScheduledMeeting: hasSchedFlag,
            nextEngagementDate: effectiveNextEngagementDate,
            subject: interpreted.subject || inbound.subject,
            bodySnippet: interpreted.body || parsed.body || null,
          },
        });
        let applied = false;
        if (applyPipelineMatch && match.proposal) {
          const fresh = await prisma.pipelines.findUnique({
            where: { contactId },
          });
          const pipelineChanged =
            match.proposal.targetPipeline !== fresh?.pipeline;
          // Apply pipeline changes (e.g. prospect → connector); avoid downgrading meeting stage via stage-only noise
          if (pipelineChanged) {
            applied = await applyInboundPipelineMatchProposal(
              contactId,
              match.proposal,
            );
          }
        }
        pipelineMatch = { ...match, applied };
      } catch (pmErr) {
        console.warn('⚠️ pipelineMatch:', (pmErr as Error)?.message);
      }
    }

    // ── 6. Mark ingested (and backfill legacy null inboundType so row is no longer legacy) ──
    await prisma.inboundEmail.update({
      where: { id: inboundEmailId },
      data: {
        ingestionStatus: 'RECORDED',
        inboundType: 'OUTREACH',
      },
    });

    return NextResponse.json({
      success: true,
      recordId,
      recordType,
      contactId,
      pipelineMatch,
      parsed: {
        contactEmail: effectiveContactEmail,
        contactName: interpreted.contactName,
        nextEngagementDate: effectiveNextEngagementDate,
        nextEngagementPurpose:
          nextEngagementPurposeForResponse ?? effectiveNextEngagementPurpose,
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
