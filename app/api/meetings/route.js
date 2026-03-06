import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { validatePipeline, snapPipelineOnContact, ensureContactPipeline } from '@/lib/services/pipelineService';

const MEETING_TYPES = ['INTRO', 'FOLLOW_UP', 'PROPOSAL_REVIEW', 'CHECK_IN', 'OTHER'];
const OUTCOMES = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_SHOW'];

/**
 * POST /api/meetings
 * Log a post-meeting.
 *
 * Body:
 * - contactId: string (required)
 * - companyHQId: string (required)
 * - meetingDate: string (ISO date "YYYY-MM-DD")
 * - meetingType: MeetingType
 * - outcome: MeetingOutcome
 * - notes: string
 * - nextAction: string
 * - nextEngagementDate: string "YYYY-MM-DD"
 * - pipeline: string (optional, for pipeline update)
 * - stage: string (optional)
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      contactId,
      companyHQId,
      meetingDate,
      meetingType,
      outcome,
      notes,
      nextAction,
      nextEngagementDate,
      pipeline,
      stage,
    } = body ?? {};

    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 }
      );
    }
    if (!companyHQId || typeof companyHQId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { pipelines: true },
    });

    if (!contact) {
      return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });
    }
    if (contact.crmId !== companyHQId) {
      return NextResponse.json(
        { success: false, error: 'Contact does not belong to this company' },
        { status: 400 }
      );
    }

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { id: true, ownerId: true, contactOwnerId: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    const ownerId = company.ownerId ?? company.contactOwnerId;
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Company has no owner' },
        { status: 400 }
      );
    }

    const meetingDateParsed = meetingDate
      ? new Date(String(meetingDate).slice(0, 10))
      : new Date();
    const meetingTypeVal = MEETING_TYPES.includes(meetingType) ? meetingType : 'OTHER';
    const outcomeVal = outcome && OUTCOMES.includes(outcome) ? outcome : null;

    const nextEngagementDateStr =
      nextEngagementDate && /^\d{4}-\d{2}-\d{2}$/.test(String(nextEngagementDate).slice(0, 10))
        ? String(nextEngagementDate).slice(0, 10)
        : null;

    const meeting = await prisma.meeting.create({
      data: {
        contactId,
        ownerId,
        crmId: companyHQId,
        meetingDate: meetingDateParsed,
        meetingType: meetingTypeVal,
        outcome: outcomeVal,
        notes: notes?.trim() || null,
        nextAction: nextAction?.trim() || null,
        nextEngagementDate: nextEngagementDateStr,
      },
    });

    const contactUpdate = {
      lastEngagementDate: meetingDateParsed,
      lastEngagementType: 'MEETING',
    };
    if (nextEngagementDateStr) {
      contactUpdate.nextEngagementDate = nextEngagementDateStr;
      contactUpdate.nextEngagementPurpose = 'MEETING_FOLLOW_UP';
    }

    if (pipeline && stage) {
      const validation = validatePipeline(pipeline, stage);
      if (validation.isValid) {
        await ensureContactPipeline(contactId, { pipeline, stage });
        await snapPipelineOnContact(contactId, pipeline, stage);
      }
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: contactUpdate,
    });

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        contactId: meeting.contactId,
        meetingDate: meeting.meetingDate,
        meetingType: meeting.meetingType,
        outcome: meeting.outcome,
        notes: meeting.notes,
        nextAction: meeting.nextAction,
        nextEngagementDate: meeting.nextEngagementDate,
        createdAt: meeting.createdAt,
      },
    });
  } catch (error) {
    console.error('POST /api/meetings error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create meeting' },
      { status: 500 }
    );
  }
}
