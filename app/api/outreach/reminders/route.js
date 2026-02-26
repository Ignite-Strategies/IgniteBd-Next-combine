import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getRemindersForDateRange } from '@/lib/services/reminderService';

/**
 * GET /api/outreach/reminders
 * Reminders for a date range (dashboard + alert email).
 * Query: companyHQId (required), dateFrom (ISO date, default today), dateTo (ISO date, default today or +7 days), limit (default 100)
 * Returns: { success, reminders: [{ dueDate, contactId, firstName, lastName, email, lastSendDate, reminderType, nextContactNote, cadenceDays }] }
 * Sorted by dueDate then name. Use for "next email sends" UI and for "you have these emails today" alert.
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
    let dateFrom = searchParams.get('dateFrom');
    let dateTo = searchParams.get('dateTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!dateFrom) dateFrom = today.toISOString().slice(0, 10);
    if (!dateTo) dateTo = today.toISOString().slice(0, 10);

    const reminders = await getRemindersForDateRange(companyHQId, {
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      limit,
    });

    return NextResponse.json({
      success: true,
      reminders,
      dateFrom,
      dateTo,
    });
  } catch (error) {
    console.error('❌ GET /api/outreach/reminders error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reminders', details: error?.message },
      { status: 500 },
    );
  }
}
