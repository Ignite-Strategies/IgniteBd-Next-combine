import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculateNextSendDate, getLastSendDate } from '@/lib/services/followUpCalculator';

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

    // Build email filter
    const emailWhere = {};
    if (sendDateFrom || sendDateTo) {
      emailWhere.sendDate = {};
      if (sendDateFrom) emailWhere.sendDate.gte = new Date(sendDateFrom);
      if (sendDateTo) emailWhere.sendDate.lte = new Date(sendDateTo);
    }
    if (hasResponded !== null) {
      emailWhere.hasResponded = hasResponded === 'true';
    }

    // Get contacts that have emails matching the filter
    const contactsWithEmails = await prisma.contact.findMany({
      where: {
        crmId: companyHQId,
        emails: {
          some: emailWhere,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        prior_relationship: true,
        persona_type: true,
        remindMeOn: true,
      },
      take: limit * 2, // Get more than needed, we'll filter by follow-up date
      skip: offset,
    });

    // Enrich each contact with email history and follow-up info
    const enrichedContacts = await Promise.all(
      contactsWithEmails.map(async (contact) => {
        try {
          // Get email history
          const emails = await prisma.emails.findMany({
            where: {
              contactId: contact.id,
              ...emailWhere,
            },
            orderBy: { sendDate: 'desc' },
            select: {
              id: true,
              sendDate: true,
              subject: true,
              source: true,
              platform: true,
              hasResponded: true,
              respondedAt: true,
            },
          });

          // Get last send date
          const lastSendDate = await getLastSendDate(contact.id);

          // Calculate next send date
          const followUpInfo = await calculateNextSendDate(contact.id);
          const nextSendDate = followUpInfo.nextSendDate;

          // Filter by follow-up date if specified
          if (followUpDateFrom || followUpDateTo) {
            if (!nextSendDate) return null; // No follow-up date, exclude
            
            const followUpDate = new Date(nextSendDate);
            if (followUpDateFrom && followUpDate < new Date(followUpDateFrom)) return null;
            if (followUpDateTo && followUpDate > new Date(followUpDateTo)) return null;
          }

          // Check manual reminder
          let effectiveNextSendDate = nextSendDate;
          if (contact.remindMeOn) {
            const remindDate = new Date(contact.remindMeOn);
            if (!effectiveNextSendDate || remindDate < effectiveNextSendDate) {
              effectiveNextSendDate = remindDate;
            }
          }

          // Check if any email has been responded to
          const hasAnyResponse = emails.some(e => e.hasResponded);

          return {
            ...contact,
            lastSendDate: lastSendDate ? lastSendDate.toISOString() : null,
            nextSendDate: effectiveNextSendDate ? effectiveNextSendDate.toISOString() : null,
            daysUntilDue: followUpInfo.daysUntilDue,
            relationship: followUpInfo.relationship,
            cadenceDays: followUpInfo.cadenceDays,
            emailCount: emails.length,
            hasResponded: hasAnyResponse, // Add this for easy filtering in UI
            emails: emails.map(e => ({
              id: e.id,
              sendDate: e.sendDate.toISOString(),
              subject: e.subject,
              source: e.source,
              platform: e.platform,
              hasResponded: e.hasResponded,
              respondedAt: e.respondedAt ? e.respondedAt.toISOString() : null,
            })),
            remindMeOn: contact.remindMeOn ? contact.remindMeOn.toISOString() : null,
          };
        } catch (error) {
          console.error(`Error enriching contact ${contact.id}:`, error);
          return null;
        }
      })
    );

    // Filter out nulls and sort by next send date (most urgent first)
    const filteredContacts = enrichedContacts
      .filter(contact => contact !== null)
      .sort((a, b) => {
        // Sort by next send date (nulls last)
        if (!a.nextSendDate && !b.nextSendDate) return 0;
        if (!a.nextSendDate) return 1;
        if (!b.nextSendDate) return -1;
        return new Date(a.nextSendDate) - new Date(b.nextSendDate);
      })
      .slice(0, limit);

    // Get total count (for pagination)
    const totalCount = await prisma.contact.count({
      where: {
        crmId: companyHQId,
        emails: {
          some: emailWhere,
        },
      },
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
