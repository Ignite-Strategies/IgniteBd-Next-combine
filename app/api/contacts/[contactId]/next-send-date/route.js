import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculateNextSendDate } from '@/lib/services/followUpCalculator';

/**
 * GET /api/contacts/[contactId]/next-send-date
 * Calculate when the next follow-up email should be sent
 * 
 * Query params:
 *   - coldFollowUpDays?: number (default: 7)
 *   - warmFollowUpDays?: number (default: 3)
 *   - establishedFollowUpDays?: number (default: 14)
 *   - dormantFollowUpDays?: number (default: 30)
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Get custom cadence from query params (if provided)
    const { searchParams } = new URL(request.url);
    const config = {};
    if (searchParams.get('coldFollowUpDays')) {
      config.coldFollowUpDays = parseInt(searchParams.get('coldFollowUpDays'), 10);
    }
    if (searchParams.get('warmFollowUpDays')) {
      config.warmFollowUpDays = parseInt(searchParams.get('warmFollowUpDays'), 10);
    }
    if (searchParams.get('establishedFollowUpDays')) {
      config.establishedFollowUpDays = parseInt(searchParams.get('establishedFollowUpDays'), 10);
    }
    if (searchParams.get('dormantFollowUpDays')) {
      config.dormantFollowUpDays = parseInt(searchParams.get('dormantFollowUpDays'), 10);
    }

    // Calculate next send date
    const result = await calculateNextSendDate(contactId, config);

    return NextResponse.json({
      success: true,
      nextSendDate: result.nextSendDate ? result.nextSendDate.toISOString() : null,
      lastSendDate: result.lastSendDate ? result.lastSendDate.toISOString() : null,
      daysUntilDue: result.daysUntilDue,
      relationship: result.relationship,
      cadenceDays: result.cadenceDays,
      isDue: result.daysUntilDue !== null && result.daysUntilDue <= 0,
    });
  } catch (error) {
    console.error('❌ Calculate next send date error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate next send date',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
