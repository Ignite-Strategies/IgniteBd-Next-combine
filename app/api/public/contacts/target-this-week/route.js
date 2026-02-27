import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getContactsWithNextEngagement } from '@/lib/services/nextEngagementService';

/**
 * GET /api/public/contacts/target-this-week
 * Public (no auth). Contacts with nextEngagementDate in the current week. Frontend can bucket.
 * Query: companyHQId (required), weekStart (optional ISO date)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    const weekStartParam = searchParams.get('weekStart');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { id: true, companyName: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const weekStartStr = weekStartParam ? String(weekStartParam).slice(0, 10) : monday.toISOString().slice(0, 10);
    const weekEndDate = new Date(weekStartStr + 'T12:00:00.000Z');
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
    const weekEndStr = weekEndDate.toISOString().slice(0, 10);

    const contacts = await getContactsWithNextEngagement(companyHQId, { limit: 1000 });
    const thisWeekContacts = contacts.filter((c) => {
      const d = c.nextEngagementDate;
      return d && d >= weekStartStr && d <= weekEndStr;
    });

    const contactsByDate = {};
    thisWeekContacts.forEach((contact) => {
      const date = contact.nextEngagementDate || '';
      if (!contactsByDate[date]) contactsByDate[date] = [];
      contactsByDate[date].push({
        id: contact.contactId,
        name: contact.goesBy || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unknown',
        email: contact.email,
        nextSendDate: contact.nextEngagementDate,
      });
    });

    return NextResponse.json({
      success: true,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      contactsByDate,
      sortedDates: Object.keys(contactsByDate).sort(),
      totalContacts: thisWeekContacts.length,
      companyHQId,
    });
  } catch (error) {
    console.error('❌ Get contacts to target this week error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contacts', details: error?.message },
      { status: 500 },
    );
  }
}
