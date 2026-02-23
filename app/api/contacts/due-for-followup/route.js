import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getContactsDueForFollowUp } from '@/lib/services/reminderService';

/**
 * GET /api/contacts/due-for-followup
 * Get contacts that are due for follow-up
 * 
 * Query params:
 *   - companyHQId: string (required)
 *   - daysOverdue?: number (default: 0, meaning due today or overdue)
 *   - limit?: number (default: 100)
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
    const daysOverdue = searchParams.get('daysOverdue')
      ? parseInt(searchParams.get('daysOverdue'), 10)
      : 0;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit'), 10)
      : 100;
    const includeManualReminders = searchParams.get('includeManualReminders') !== 'false'; // Default: true

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

    // Get contacts due for follow-up
    const contacts = await getContactsDueForFollowUp(companyHQId, {
      daysOverdue,
      limit,
      includeManualReminders,
    });

    return NextResponse.json({
      success: true,
      contacts,
      count: contacts.length,
      companyHQId,
      filters: {
        daysOverdue,
        limit,
        includeManualReminders,
      },
    });
  } catch (error) {
    console.error('❌ Get contacts due for follow-up error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch contacts due for follow-up',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
