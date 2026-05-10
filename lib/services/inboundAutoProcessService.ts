/**
 * Auto-process inbound SendGrid rows: parse → ToolLoopAgent or legacy interpret → apply recording.
 * Shared by POST /api/inbound-parse/push-to-ai and webhook/bulk processors.
 */

import type { PrismaClient } from '@prisma/client';
import { universalEmailParser } from '@/lib/services/universalEmailParser';
import { interpretEngagement } from '@/lib/services/aiEngagementInterpreter';
import type { EngagementInterpretation } from '@/lib/services/aiEngagementInterpreter';
import {
  bumpProspectNeedToEngageToEngaged,
  resolveOutreachContactIdForWave1,
} from '@/lib/services/inboundProspectBump';
import {
  applyInboundRecordingCore,
  inboundEmailCompanyInclude,
  type UniversalParsedEmail,
} from '@/lib/services/inboundRecordingApply';
import { runInboundEmailAgentPipeline } from '@/lib/agents/inboundEmailAgent';

export type AutoProcessInboundOptions = {
  inboundEmailId: string;
  nextEngagementDateOverride?: string | null;
  contactEmailOverride?: string | null;
  contactIdOverride?: string | null;
  nextEngagementPurposeTopLevel?: string | null;
  /** Skip AI when UI already ran interpret */
  preInterpreted?: unknown | null;
  generatePipelineMatch?: boolean;
  applyPipelineMatch?: boolean;
  updateContactProfile?: boolean;
  newContactEmail?: string | null;
  newCompanyName?: string | null;
  /** When true (webhook auto-agent), set InboundEmail.autoProcessed */
  markAutoProcessed?: boolean;
  /**
   * When true, refuse unless ingestionStatus is RECEIVED (bulk + webhook).
   * Manual push-to-ai omits this so FAILED / duplicate retries stay possible.
   */
  requireReceivedStatus?: boolean;
};

export type AutoProcessInboundSuccess = {
  success: true;
  recordId: string;
  recordType: string;
  contactId: string | null;
  pipelineMatch: {
    signals: import('@/lib/services/inboundPipelineMatchService').InboundPipelineMatchSignals;
    proposal: import('@/lib/services/inboundPipelineMatchService').InboundPipelineMatchProposal | null;
    applied: boolean;
  } | null;
  connectorIntroductionMadeBump: { contactId: string; email: string } | null;
  parsed: {
    contactEmail: string | undefined;
    contactName: string | null;
    nextEngagementDate: string | null;
    nextEngagementPurpose: string | null;
    isResponse: boolean;
    summary: string;
    activityType: string;
    activityDate: string | null;
    referralSourceEmail: string | null;
    referralSourceName: string | null;
  };
};

export type AutoProcessInboundFailure = {
  success: false;
  status: number;
  error: string;
};

export type AutoProcessInboundResult = AutoProcessInboundSuccess | AutoProcessInboundFailure;

function interpretationComplete(interpreted: unknown): interpreted is EngagementInterpretation {
  return (
    !!interpreted &&
    typeof interpreted === 'object' &&
    'activityType' in interpreted &&
    'nextEngagementPurpose' in interpreted
  );
}

/**
 * Full record pipeline for one InboundEmail row (same behavior as push-to-ai).
 *
 * Interpretation:
 * - Default: ToolLoopAgent (`runInboundEmailAgentPipeline`) — lookupContact + recordActivity; DB writes via `applyInboundRecordingCore`.
 * - Legacy single-shot OpenAI: set env `INBOUND_USE_LEGACY_INTERPRETER=true` to use `interpretEngagement` instead.
 * - `preInterpreted` from the UI skips AI when complete (`interpretationComplete`).
 */
export async function autoProcessInboundEmail(
  prisma: PrismaClient,
  opts: AutoProcessInboundOptions,
): Promise<AutoProcessInboundResult> {
  const { inboundEmailId } = opts;
  const nextEngagementDateOverride =
    typeof opts.nextEngagementDateOverride === 'string' &&
    opts.nextEngagementDateOverride.trim()
      ? opts.nextEngagementDateOverride.trim()
      : null;
  const contactEmailOverride =
    typeof opts.contactEmailOverride === 'string' && opts.contactEmailOverride.trim()
      ? opts.contactEmailOverride.trim()
      : null;
  const contactIdOverride =
    typeof opts.contactIdOverride === 'string' && opts.contactIdOverride.trim()
      ? opts.contactIdOverride.trim()
      : null;
  const nextEngagementPurposeTopLevel =
    typeof opts.nextEngagementPurposeTopLevel === 'string' &&
    opts.nextEngagementPurposeTopLevel.trim()
      ? opts.nextEngagementPurposeTopLevel.trim()
      : null;
  const preInterpreted = opts.preInterpreted ?? null;
  const generatePipelineMatch = opts.generatePipelineMatch === true;
  const applyPipelineMatch = opts.applyPipelineMatch === true;
  const updateContactProfile = opts.updateContactProfile === true;
  const newContactEmail = opts.newContactEmail ?? null;
  const newCompanyName = opts.newCompanyName ?? null;
  const markAutoProcessed = opts.markAutoProcessed === true;
  const requireReceivedStatus = opts.requireReceivedStatus === true;

  const inbound = await prisma.inboundEmail.findUnique({
    where: { id: inboundEmailId },
    include: inboundEmailCompanyInclude,
  });

  if (!inbound) {
    return { success: false, status: 404, error: 'InboundEmail not found' };
  }

  if (requireReceivedStatus && inbound.ingestionStatus !== 'RECEIVED') {
    return {
      success: false,
      status: 409,
      error: `InboundEmail not pending (status: ${inbound.ingestionStatus})`,
    };
  }

  const companyHQId = inbound.companyHQId;
  if (!companyHQId) {
    return { success: false, status: 400, error: 'InboundEmail has no company' };
  }

  const company = inbound.company_hqs;
  const ownerId = company?.ownerId ?? company?.contactOwnerId ?? null;
  if (!ownerId) {
    return { success: false, status: 400, error: 'Company has no owner.' };
  }

  const owner = company?.owners_company_hqs_ownerIdToowners;
  const ownerContext = {
    name: owner?.name || null,
    email: owner?.email || null,
    companyName: company?.companyName || null,
  };

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

  try {
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

    const recordingOpts = {
      contactEmailOverride,
      contactIdOverride,
      nextEngagementDateOverride,
      nextEngagementPurposeTopLevel,
      generatePipelineMatch,
      applyPipelineMatch,
      updateContactProfile,
      newContactEmail,
      newCompanyName,
      markAutoProcessed,
    };

    const parsedUnknown = parsed as UniversalParsedEmail;

    let recordingSuccess;
    if (interpretationComplete(preInterpreted)) {
      recordingSuccess = await applyInboundRecordingCore(prisma, {
        inboundEmailId,
        inbound,
        parsed: parsedUnknown,
        interpreted: preInterpreted,
        ownerId,
        companyHQId,
        opts: recordingOpts,
      });
    } else if (process.env.INBOUND_USE_LEGACY_INTERPRETER === 'true') {
      const interpreted = await interpretEngagement(
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
      recordingSuccess = await applyInboundRecordingCore(prisma, {
        inboundEmailId,
        inbound,
        parsed: parsedUnknown,
        interpreted,
        ownerId,
        companyHQId,
        opts: recordingOpts,
      });
    } else {
      recordingSuccess = await runInboundEmailAgentPipeline(prisma, {
        inboundEmailId,
        inbound,
        parsed: parsedUnknown,
        ownerContext,
        ownerId,
        companyHQId,
        recordingOpts,
      });
    }

    return recordingSuccess as AutoProcessInboundSuccess;
  } catch (error) {
    console.error('❌ autoProcessInboundEmail error:', error);
    try {
      await prisma.inboundEmail.update({
        where: { id: inboundEmailId },
        data: { ingestionStatus: 'FAILED' },
      });
    } catch (updErr) {
      console.warn('⚠️ Failed to mark InboundEmail FAILED:', (updErr as Error)?.message);
    }
    return {
      success: false,
      status: 500,
      error: error instanceof Error ? error.message : 'Failed to record activity',
    };
  }
}
