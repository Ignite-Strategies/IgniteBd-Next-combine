import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculateNextSendDate, getLastSendDate } from '@/lib/services/emailCadenceService';

/** Coerce Date, ISO string, or YYYY-MM-DD to ISO string; null/undefined → null. */
function toISOStringSafe(val) {
  if (val == null) return null;
  if (typeof val === 'string') return new Date(val).toISOString();
  if (typeof val.toISOString === 'function') return val.toISOString();
  return new Date(val).toISOString();
}

/**
 * GET /api/outreach/tracker
 * Get all contacts with email sends, with filtering by send date and follow-up date
 * 
 * Query params:
 *   - companyHQId: string (required)
 *   - sendDateFrom?: string (ISO date)
 *   - sendDateTo?: string (ISO date)
 *   - followUpDateFrom?: string (ISO date)
 *   - followUpDateTo?: string (ISO date)
 *   - hasResponded?: boolean
 *   - limit?: number (default: 100)
 *   - offset?: number (default: 0)
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    const sendDateFrom = searchParams.get('sendDateFrom');
    const sendDateTo = searchParams.get('sendDateTo');
    const followUpDateFrom = searchParams.get('followUpDateFrom');
    const followUpDateTo = searchParams.get('followUpDateTo');
    const hasResponded = searchParams.get('hasResponded');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Verify company exists
    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Contacts that have at least one "send" OR a next engagement date (so e.g. "friend due April 1" with no sends still shows)
    const activityWhere = {
      OR: [
        { event: 'sent' },
        { source: 'OFF_PLATFORM', sentAt: { not: null } },
      ],
    };
    if (sendDateFrom) {
      activityWhere.AND = [
        ...(activityWhere.AND || []),
        { OR: [{ sentAt: { gte: new Date(sendDateFrom) } }, { sentAt: null, createdAt: { gte: new Date(sendDateFrom) } }] },
      ];
    }
    if (sendDateTo) {
      activityWhere.AND = [
        ...(activityWhere.AND || []),
        { OR: [{ sentAt: { lte: new Date(sendDateTo) } }, { sentAt: null, createdAt: { lte: new Date(sendDateTo) } }] },
      ];
    }
    if (hasResponded === 'true') activityWhere.responseFromEmail = { not: null };
    if (hasResponded === 'false') activityWhere.responseFromEmail = null;

    const contactWhere = {
      crmId: companyHQId,
      OR: [
        { email_activities: { some: activityWhere } },
        { nextEngagementDate: { not: null } },
        { remindMeOn: { not: null } },
        { nextContactedAt: { not: null } },
      ],
    };

    const contactsWithActivities = await prisma.contact.findMany({
      where: contactWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        prior_relationship: true,
        persona_type: true,
        remindMeOn: true,
      },
      take: limit * 2,
      skip: offset,
    });

    const enrichedContacts = await Promise.all(
      contactsWithActivities.map(async (contact) => {
        try {
          const activityFilter = {
            contact_id: contact.id,
            OR: [
              { event: 'sent' },
              { source: 'OFF_PLATFORM', sentAt: { not: null } },
            ],
          };
          if (sendDateFrom) {
            activityFilter.AND = activityFilter.AND || [];
            activityFilter.AND.push({ OR: [{ sentAt: { gte: new Date(sendDateFrom) } }, { sentAt: null, createdAt: { gte: new Date(sendDateFrom) } }] });
          }
          if (sendDateTo) {
            activityFilter.AND = activityFilter.AND || [];
            activityFilter.AND.push({ OR: [{ sentAt: { lte: new Date(sendDateTo) } }, { sentAt: null, createdAt: { lte: new Date(sendDateTo) } }] });
          }
          if (hasResponded === 'true') activityFilter.responseFromEmail = { not: null };
          if (hasResponded === 'false') activityFilter.responseFromEmail = null;

          const activities = await prisma.email_activities.findMany({
            where: activityFilter,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              sentAt: true,
              createdAt: true,
              subject: true,
              source: true,
              platform: true,
              responseFromEmail: true,
            },
          });

          const respIds = activities.map(a => a.responseFromEmail).filter(Boolean);
          const respRows = respIds.length
            ? await prisma.email_activities.findMany({
                where: { id: { in: respIds } },
                select: { id: true, sentAt: true },
              })
            : [];
          const respAtMap = new Map(respRows.map(r => [r.id, r.sentAt]));

          const lastSendDate = await getLastSendDate(contact.id);
          const followUpInfo = await calculateNextSendDate(contact.id);
          const nextSendDate = followUpInfo.nextSendDate;

          if (followUpDateFrom || followUpDateTo) {
            if (!nextSendDate) return null;
            const followUpDate = new Date(nextSendDate);
            if (followUpDateFrom && followUpDate < new Date(followUpDateFrom)) return null;
            if (followUpDateTo && followUpDate > new Date(followUpDateTo)) return null;
          }

          let effectiveNextSendDate = nextSendDate;
          if (contact.remindMeOn) {
            const remindDate = new Date(contact.remindMeOn);
            if (!effectiveNextSendDate || remindDate < effectiveNextSendDate) {
              effectiveNextSendDate = remindDate;
            }
          }

          const hasAnyResponse = activities.some(a => !!a.responseFromEmail);
          if (hasResponded === 'true' && !hasAnyResponse) return null;
          const sendDate = (a) => toISOStringSafe(a.sentAt ?? a.createdAt);

          return {
            ...contact,
            lastSendDate: toISOStringSafe(lastSendDate),
            nextSendDate: toISOStringSafe(effectiveNextSendDate),
            daysUntilDue: followUpInfo.daysUntilDue,
            relationship: followUpInfo.relationship,
            cadenceDays: followUpInfo.cadenceDays,
            emailCount: activities.length,
            hasResponded: hasAnyResponse,
            isManualOverride: followUpInfo.isManualOverride ?? false,
            doNotContactAgain: followUpInfo.doNotContactAgain ?? false,
            nextContactNote: followUpInfo.nextContactNote ?? null,
            emails: activities.map(e => ({
              id: e.id,
              sendDate: sendDate(e),
              subject: e.subject,
              source: e.source,
              platform: e.platform,
              hasResponded: !!e.responseFromEmail,
              respondedAt: toISOStringSafe(respAtMap.get(e.responseFromEmail)),
            })),
            remindMeOn: toISOStringSafe(contact.remindMeOn),
          };
        } catch (error) {
          console.error(`Error enriching contact ${contact.id}:`, error);
          return null;
        }
      })
    );

    const filteredContacts = enrichedContacts
      .filter(contact => contact !== null)
      .sort((a, b) => {
        if (!a.nextSendDate && !b.nextSendDate) return 0;
        if (!a.nextSendDate) return 1;
        if (!b.nextSendDate) return -1;
        return new Date(a.nextSendDate) - new Date(b.nextSendDate);
      })
      .slice(0, limit);

    const totalCount = await prisma.contact.count({
      where: contactWhere,
    });

    return NextResponse.json({
      success: true,
      contacts: filteredContacts,
      count: filteredContacts.length,
      totalCount,
      pagination: {
        limit,
        offset,
        hasMore: offset + filteredContacts.length < totalCount,
      },
      filters: {
        sendDateFrom,
        sendDateTo,
        followUpDateFrom,
        followUpDateTo,
        hasResponded,
      },
    });
  } catch (error) {
    console.error('❌ Get outreach tracker error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch outreach tracker data',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
