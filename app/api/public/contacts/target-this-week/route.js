import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getContactsDueForFollowUp } from '@/lib/services/reminderService';

/**
 * GET /api/public/contacts/target-this-week
 * Public endpoint (no auth) to get contacts to target this week
 * 
 * Query params:
 *   - companyHQId: string (required)
 *   - weekStart?: string (ISO date, default: start of current week)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Verify company exists
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

    // Calculate week start (Monday)
    const weekStartParam = searchParams.get('weekStart');
    let weekStart;
    if (weekStartParam) {
      weekStart = new Date(weekStartParam);
    } else {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      weekStart = new Date(today.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
    }

    // Calculate week end (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Get contacts due for follow-up this week
    // We'll get contacts due in the next 7 days
    const contacts = await getContactsDueForFollowUp(companyHQId, {
      daysOverdue: -7, // Include contacts due up to 7 days in the future
      limit: 1000,
      includeManualReminders: true,
    });

    // Filter to only contacts due this week
    const thisWeekContacts = contacts.filter((contact) => {
      if (!contact.nextSendDate) return false;
      const nextSend = new Date(contact.nextSendDate);
      return nextSend >= weekStart && nextSend <= weekEnd;
    });

    // Group by date
    const contactsByDate = {};
    thisWeekContacts.forEach((contact) => {
      const date = new Date(contact.nextSendDate).toISOString().split('T')[0];
      if (!contactsByDate[date]) {
        contactsByDate[date] = [];
      }
      contactsByDate[date].push({
        id: contact.id,
        name: contact.goesBy || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unknown',
        email: contact.email,
        nextSendDate: contact.nextSendDate,
      });
    });

    // Sort dates
    const sortedDates = Object.keys(contactsByDate).sort();

    return NextResponse.json({
      success: true,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      contactsByDate,
      sortedDates,
      totalContacts: thisWeekContacts.length,
      companyHQId,
    });
  } catch (error) {
    console.error('❌ Get contacts to target this week error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contacts',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
